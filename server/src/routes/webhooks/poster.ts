import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { awardCompletedOrderLoyalty } from '../../lib/orderRewards'
import { calcEarnedPoints, getLevel, getNextLevel } from '../../lib/loyalty'
import { normalizePhone } from '../../lib/phone'

const BOT = process.env.BOT_TOKEN || ''

async function tgSend(chatId: string, text: string) {
  if (!BOT) return
  try {
    await fetch('https://api.telegram.org/bot' + BOT + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch (e) { console.error('tgSend:', e) }
}

// Знайти юзера по телефону з Poster транзакції
async function findUserByPosterPhone(posterSubdomain: string, token: string, transactionId: number, log: any): Promise<{ userId: number; phone: string } | null> {
  try {
    const url = `https://${posterSubdomain}.joinposter.com/api/transactions.getTransactionById?token=${token}&transaction_id=${transactionId}`
    const res = await fetch(url)
    const data = await res.json() as any
    log.info({ transactionId, data: JSON.stringify(data).slice(0, 300) }, 'Poster transaction details')

    // Poster повертає client_id або phone клієнта
    const clientId = data?.response?.client_id
    const phone = data?.response?.client_phone || data?.response?.phone

    if (phone) {
      const normalized = normalizePhone(phone)
      const user = await prisma.user.findFirst({ where: { phone: normalized } })
      if (user) { log.info({ userId: user.id, phone: normalized }, 'Found user by phone'); return { userId: user.id, phone: normalized } }
    }

    if (clientId) {
      // Отримуємо телефон клієнта з Poster
      const clientUrl = `https://${posterSubdomain}.joinposter.com/api/clients.getClient?token=${token}&client_id=${clientId}`
      const clientRes = await fetch(clientUrl)
      const clientData = await clientRes.json() as any
      log.info({ clientId, clientData: JSON.stringify(clientData).slice(0, 300) }, 'Poster client details')

      const clientPhone = clientData?.response?.phone
      if (clientPhone) {
        const normalized = normalizePhone(String(clientPhone))
        const user = await prisma.user.findFirst({ where: { phone: normalized } })
        if (user) { log.info({ userId: user.id, phone: normalized }, 'Found user by Poster client phone'); return { userId: user.id, phone: normalized } }
      }
    }

    return null
  } catch (e) {
    log.error({ err: String(e) }, 'findUserByPosterPhone error')
    return null
  }
}

// Нарахувати бали офлайн клієнту (в Poster але без нашого замовлення)
async function awardOfflinePoints(userId: number, totalGrn: number, transactionId: number, locationName: string, log: any) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return 0

  const idempotencyKey = `poster-offline-${transactionId}`
  const existing = await prisma.pointsTransaction.findFirst({ where: { idempotencyKey } })
  if (existing) { log.info({ transactionId }, 'Offline points already awarded'); return 0 }

  const pts = calcEarnedPoints(totalGrn, user.points)
  if (pts <= 0) return 0

  await prisma.$transaction(async (tx: any) => {
    await tx.pointsTransaction.create({
      data: {
        userId,
        amount: pts,
        type: 'ORDER',
        description: `Бали за офлайн замовлення в ${locationName} (Poster #${transactionId})`,
        idempotencyKey,
      },
    })
    await tx.user.update({
      where: { id: userId },
      data: {
        points: { increment: pts },
        monthlyOrders: { increment: 1 },
      },
    })
  })

  log.info({ userId, pts, transactionId }, 'Offline points awarded')
  return pts
}

export default async function posterWebhookRoutes(app: FastifyInstance) {

  app.post('/', async (req, reply) => {
    reply.send({ success: true })

    const p = req.body as any
    app.log.info({ object: p.object, action: p.action, object_id: p.object_id, account: p.account }, 'Poster webhook received')

    if (!p.account || !p.object_id) return

    const location = await prisma.location.findFirst({
      where: { posterSubdomain: p.account, hasPoster: true },
    })
    if (!location) { app.log.warn({ account: p.account }, 'Location not found'); return }

    // ── TRANSACTION CLOSED = оплачено ────────────────────────────
    if (p.object === 'transaction' && p.action === 'closed') {
      app.log.info({ transactionId: p.object_id }, 'Transaction CLOSED')

      // Спочатку шукаємо наше онлайн замовлення
      const onlineOrder = await prisma.order.findFirst({
        where: {
          locationId: location.id,
          status: { in: ['SENT_TO_POS', 'ACCEPTED', 'PREPARING', 'READY'] },
        },
        include: {
          user: true,
          items: { include: { product: { select: { name: true } }, bundle: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (onlineOrder) {
        await completeOnlineOrder(onlineOrder, location.name, app.log)
        return
      }

      // Якщо онлайн замовлення немає — це офлайн замовлення в Poster
      // Шукаємо клієнта по телефону
      if (!location.posterToken) return

      app.log.info({ transactionId: p.object_id }, 'No online order found — checking offline Poster client')

      // Отримуємо суму транзакції і телефон клієнта
      try {
        const txUrl = `https://${p.account}.joinposter.com/api/transactions.getTransactionById?token=${location.posterToken}&transaction_id=${p.object_id}`
        const txRes = await fetch(txUrl)
        const txData = await txRes.json() as any
        app.log.info({ txData: JSON.stringify(txData).slice(0, 500) }, 'Offline transaction data')

        const totalPoster = Number(txData?.response?.sum || txData?.response?.total_sum || 0) / 100
        if (totalPoster <= 0) { app.log.info({ transactionId: p.object_id }, 'No total sum in transaction'); return }

        const userInfo = await findUserByPosterPhone(p.account, location.posterToken, Number(p.object_id), app.log)
        if (!userInfo) { app.log.info({ transactionId: p.object_id }, 'No PerkUp user found for Poster client'); return }

        const pts = await awardOfflinePoints(userInfo.userId, totalPoster, Number(p.object_id), location.name, app.log)

        if (pts > 0) {
          const updatedUser = await prisma.user.findUnique({ where: { id: userInfo.userId } })
          const bal = updatedUser?.points || 0
          const lvl = getLevel(bal)
          const em: Record<string, string> = { Bronze: '\u{1f949}', Silver: '\u{1f948}', Gold: '\u{1f947}', Platinum: '\u{1f48e}' }
          const sep = '\u2500'.repeat(28)

          const text = [
            '\u{1f9fe} *\u041e\u0444\u043b\u0430\u0439\u043d \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f*',
            sep,
            '\u{1f4cd} ' + location.name,
            sep,
            '\u{1f4b3} *\u0421\u0443\u043c\u0430: ' + Math.round(totalPoster) + ' \u0433\u0440\u043d*',
            sep,
            (em[lvl] || '') + ' *+' + pts + ' \u0431\u0430\u043b\u0456\u0432 \u043d\u0430\u0440\u0430\u0445\u043e\u0432\u0430\u043d\u043e*',
            '   \u0411\u0430\u043b\u0430\u043d\u0441: ' + bal + ' \u0431\u0430\u043b\u0456\u0432',
            sep,
            '_\u0414\u044f\u043a\u0443\u0454\u043c\u043e! \u041f\u0440\u0438\u0445\u043e\u0434\u044c\u0442\u0435 \u0437\u043d\u043e\u0432\u0443 \u2615_',
          ].join('\n')

          await tgSend(String(updatedUser?.telegramId), text)
          app.log.info({ userId: userInfo.userId, pts, bal }, 'Offline order: points sent to Telegram')
        }
      } catch (e) {
        app.log.error({ err: String(e) }, 'Offline order processing error')
      }
      return
    }

    // ── INCOMING ORDER CHANGED ────────────────────────────────────
    if (p.object === 'incoming_order' && p.action === 'changed') {
      if (!location.posterToken) return

      const posterOrderId = Number(p.object_id)
      const order = await prisma.order.findFirst({
        where: { posterOrderId, locationId: location.id },
        include: { user: true },
      })
      if (!order) return
      if (['CANCELLED', 'COMPLETED'].includes(order.status)) return

      try {
        const url = `https://${p.account}.joinposter.com/api/incomingOrders.getIncomingOrder?token=${location.posterToken}&incoming_order_id=${posterOrderId}`
        const res = await fetch(url)
        const data = await res.json() as any
        const posterStatus = Number(data?.response?.status ?? 0)
        const transactionId = data?.response?.transaction_id

        app.log.info({ posterStatus, transactionId, orderId: order.id }, 'Poster incoming_order status')

        if (posterStatus === 7 && !transactionId) {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
          await tgSend(String(order.user.telegramId), '\u274c \u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #' + order.id + ' \u0441\u043a\u0430\u0441\u043e\u0432\u0430\u043d\u043e \u0431\u0430\u0440\u0438\u0441\u0442\u043e\u044e.')
          app.log.info({ orderId: order.id }, 'Order CANCELLED')
        } else if (posterStatus === 7 && transactionId) {
          app.log.info({ orderId: order.id }, 'Status 7 with transaction — waiting for transaction:closed')
        } else if (posterStatus === 2 && order.status === 'SENT_TO_POS') {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'ACCEPTED' } })
          await tgSend(String(order.user.telegramId), '\u2615 \u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #' + order.id + ' \u043f\u0440\u0438\u0439\u043d\u044f\u0442\u043e! \u0413\u043e\u0442\u0443\u0454\u043c\u043e...')
          app.log.info({ orderId: order.id }, 'Order ACCEPTED')
        } else {
          app.log.info({ posterStatus, transactionId }, 'incoming_order changed - no action')
        }
      } catch (e) {
        app.log.error({ err: String(e) }, 'Error checking Poster order status')
      }
      return
    }

    if (p.object === 'incoming_order' && p.action === 'added') {
      app.log.info({ posterOrderId: p.object_id }, 'incoming_order added - already tracked')
    }
  })
}

// ─── Завершення онлайн замовлення ────────────────────────────────
async function completeOnlineOrder(order: any, locationName: string, log: any) {
  if (order.status === 'COMPLETED') { log.info({ orderId: order.id }, 'Already completed'); return }

  try {
    const pts = await prisma.$transaction((tx: any) => awardCompletedOrderLoyalty(tx, {
      orderId: order.id,
      userId: order.userId,
      total: Number(order.total),
      userPoints: order.user.points,
    }))

    await prisma.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } })

    const updated = await prisma.user.findUnique({ where: { id: order.userId } })
    const bal = updated?.points || 0
    const lvl = getLevel(bal)
    const em: Record<string, string> = { Bronze: '\u{1f949}', Silver: '\u{1f948}', Gold: '\u{1f947}', Platinum: '\u{1f48e}' }
    const sep = '\u2500'.repeat(28)

    let itemLines = ''
    for (const item of order.items) {
      const name = item.product?.name || item.bundle?.name || 'Item'
      const price = Math.round(Number(item.price || 0))
      itemLines += '  ' + name + ' x' + item.quantity + '  ' + (price * item.quantity) + ' grn\n'
    }

    const text = [
      '\u{1f9fe} *\u0427\u0435\u043a #' + order.id + '*',
      sep,
      '\u{1f4cd} ' + locationName,
      sep,
      itemLines.trim(),
      sep,
      '\u{1f4b3} *\u0420\u0430\u0437\u043e\u043c: ' + Math.round(Number(order.total)) + ' \u0433\u0440\u043d*',
      sep,
      (em[lvl] || '') + ' *+' + pts + ' \u0431\u0430\u043b\u0456\u0432 \u043d\u0430\u0440\u0430\u0445\u043e\u0432\u0430\u043d\u043e*',
      '   \u0411\u0430\u043b\u0430\u043d\u0441: ' + bal + ' \u0431\u0430\u043b\u0456\u0432',
      sep,
      '_\u0414\u044f\u043a\u0443\u0454\u043c\u043e! \u041f\u0440\u0438\u0445\u043e\u0434\u044c\u0442\u0435 \u0437\u043d\u043e\u0432\u0443 \u2615_',
    ].join('\n')

    if (BOT) {
      await fetch('https://api.telegram.org/bot' + BOT + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: String(order.user.telegramId), text, parse_mode: 'Markdown' }),
      })
    }

    log.info({ orderId: order.id, pts, bal }, 'Online order COMPLETED + receipt sent')
  } catch (e) {
    log.error({ err: String(e), orderId: order.id }, 'completeOnlineOrder error')
  }
}
    if (clientId) {
      // Отримуємо телефон клієнта з Poster
      const clientUrl = `https://${posterSubdomain}.joinposter.com/api/clients.getClient?token=${token}&client_id=${clientId}`
      const clientRes = await fetch(clientUrl)
      const clientData = await clientRes.json() as any
      log.info({ clientId, clientData: JSON.stringify(clientData).slice(0, 300) }, 'Poster client details')

      const clientPhone = clientData?.response?.phone
      if (clientPhone) {
        const normalized = normalizePhone(String(clientPhone))
        const user = await prisma.user.findFirst({ where: { phone: normalized } })
        if (user) { log.info({ userId: user.id, phone: normalized }, 'Found user by Poster client phone'); return { userId: user.id, phone: normalized } }
      }
    }

    return null
  } catch (e) {
    log.error({ err: String(e) }, 'findUserByPosterPhone error')
    return null
  }
}

// Нарахувати бали офлайн клієнту (в Poster але без нашого замовлення)
async function awardOfflinePoints(userId: number, totalGrn: number, transactionId: number, locationName: string, log: any) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return 0

  const idempotencyKey = `poster-offline-${transactionId}`
  const existing = await prisma.pointsTransaction.findFirst({ where: { idempotencyKey } })
  if (existing) { log.info({ transactionId }, 'Offline points already awarded'); return 0 }

  const pts = calcEarnedPoints(totalGrn, user.points)
  if (pts <= 0) return 0

  await prisma.$transaction(async (tx: any) => {
    await tx.pointsTransaction.create({
      data: {
        userId,
        amount: pts,
        type: 'ORDER',
        description: `Бали за офлайн замовлення в ${locationName} (Poster #${transactionId})`,
        idempotencyKey,
      },
    })
    await tx.user.update({
      where: { id: userId },
      data: {
        points: { increment: pts },
        monthlyOrders: { increment: 1 },
      },
    })
  })

  log.info({ userId, pts, transactionId }, 'Offline points awarded')
  return pts
}

export default async function posterWebhookRoutes(app: FastifyInstance) {

  app.post('/', async (req, reply) => {
    reply.send({ success: true })

    const p = req.body as any
    app.log.info({ object: p.object, action: p.action, object_id: p.object_id, account: p.account }, 'Poster webhook received')

    if (!p.account || !p.object_id) return

    const location = await prisma.location.findFirst({
      where: { posterSubdomain: p.account, hasPoster: true },
    })
    if (!location) { app.log.warn({ account: p.account }, 'Location not found'); return }

    // ── TRANSACTION CLOSED = оплачено ────────────────────────────
    if (p.object === 'transaction' && p.action === 'closed') {
      app.log.info({ transactionId: p.object_id }, 'Transaction CLOSED')

      // Спочатку шукаємо наше онлайн замовлення
      const onlineOrder = await prisma.order.findFirst({
        where: {
          locationId: location.id,
          status: { in: ['SENT_TO_POS', 'ACCEPTED', 'PREPARING', 'READY'] },
        },
        include: {
          user: true,
          items: { include: { product: { select: { name: true } }, bundle: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (onlineOrder) {
        await completeOnlineOrder(onlineOrder, location.name, app.log)
        return
      }

      // Якщо онлайн замовлення немає — це офлайн замовлення в Poster
      // Шукаємо клієнта по телефону
      if (!location.posterToken) return

      app.log.info({ transactionId: p.object_id }, 'No online order found — checking offline Poster client')

      // Отримуємо суму транзакції і телефон клієнта
      try {
        const txUrl = `https://${p.account}.joinposter.com/api/transactions.getTransactionById?token=${location.posterToken}&transaction_id=${p.object_id}`
        const txRes = await fetch(txUrl)
        const txData = await txRes.json() as any
        app.log.info({ txData: JSON.stringify(txData).slice(0, 500) }, 'Offline transaction data')

        const totalPoster = Number(txData?.response?.sum || txData?.response?.total_sum || 0) / 100
        if (totalPoster <= 0) { app.log.info({ transactionId: p.object_id }, 'No total sum in transaction'); return }

        const userInfo = await findUserByPosterPhone(p.account, location.posterToken, Number(p.object_id), app.log)
        if (!userInfo) { app.log.info({ transactionId: p.object_id }, 'No PerkUp user found for Poster client'); return }

        const pts = await awardOfflinePoints(userInfo.userId, totalPoster, Number(p.object_id), location.name, app.log)

        if (pts > 0) {
          const updatedUser = await prisma.user.findUnique({ where: { id: userInfo.userId } })
          const bal = updatedUser?.points || 0
          const lvl = getLevel(bal)
          const em: Record<string, string> = { Bronze: '\u{1f949}', Silver: '\u{1f948}', Gold: '\u{1f947}', Platinum: '\u{1f48e}' }
          const sep = '\u2500'.repeat(28)

          const text = [
            '\u{1f9fe} *\u041e\u0444\u043b\u0430\u0439\u043d \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f*',
            sep,
            '\u{1f4cd} ' + location.name,
            sep,
            '\u{1f4b3} *\u0421\u0443\u043c\u0430: ' + Math.round(totalPoster) + ' \u0433\u0440\u043d*',
            sep,
            (em[lvl] || '') + ' *+' + pts + ' \u0431\u0430\u043b\u0456\u0432 \u043d\u0430\u0440\u0430\u0445\u043e\u0432\u0430\u043d\u043e*',
            '   \u0411\u0430\u043b\u0430\u043d\u0441: ' + bal + ' \u0431\u0430\u043b\u0456\u0432',
            sep,
            '_\u0414\u044f\u043a\u0443\u0454\u043c\u043e! \u041f\u0440\u0438\u0445\u043e\u0434\u044c\u0442\u0435 \u0437\u043d\u043e\u0432\u0443 \u2615_',
          ].join('\n')

          await tgSend(String(updatedUser?.telegramId), text)
          app.log.info({ userId: userInfo.userId, pts, bal }, 'Offline order: points sent to Telegram')
        }
      } catch (e) {
        app.log.error({ err: String(e) }, 'Offline order processing error')
      }
      return
    }

    // ── INCOMING ORDER CHANGED ────────────────────────────────────
    if (p.object === 'incoming_order' && p.action === 'changed') {
      if (!location.posterToken) return

      const posterOrderId = Number(p.object_id)
      const order = await prisma.order.findFirst({
        where: { posterOrderId, locationId: location.id },
        include: { user: true },
      })
      if (!order) return
      if (['CANCELLED', 'COMPLETED'].includes(order.status)) return

      try {
        const url = `https://${p.account}.joinposter.com/api/incomingOrders.getIncomingOrder?token=${location.posterToken}&incoming_order_id=${posterOrderId}`
        const res = await fetch(url)
        const data = await res.json() as any
        const posterStatus = Number(data?.response?.status ?? 0)
        const transactionId = data?.response?.transaction_id

        app.log.info({ posterStatus, transactionId, orderId: order.id }, 'Poster incoming_order status')

        if (posterStatus === 7 && !transactionId) {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
          await tgSend(String(order.user.telegramId), '\u274c \u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #' + order.id + ' \u0441\u043a\u0430\u0441\u043e\u0432\u0430\u043d\u043e \u0431\u0430\u0440\u0438\u0441\u0442\u043e\u044e.')
          app.log.info({ orderId: order.id }, 'Order CANCELLED')
        } else if (posterStatus === 7 && transactionId) {
          app.log.info({ orderId: order.id }, 'Status 7 with transaction — waiting for transaction:closed')
        } else if (posterStatus === 2 && order.status === 'SENT_TO_POS') {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'ACCEPTED' } })
          await tgSend(String(order.user.telegramId), '\u2615 \u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #' + order.id + ' \u043f\u0440\u0438\u0439\u043d\u044f\u0442\u043e! \u0413\u043e\u0442\u0443\u0454\u043c\u043e...')
          app.log.info({ orderId: order.id }, 'Order ACCEPTED')
        } else {
          app.log.info({ posterStatus, transactionId }, 'incoming_order changed - no action')
        }
      } catch (e) {
        app.log.error({ err: String(e) }, 'Error checking Poster order status')
      }
      return
    }

    if (p.object === 'incoming_order' && p.action === 'added') {
      app.log.info({ posterOrderId: p.object_id }, 'incoming_order added - already tracked')
    }
  })
}

// ─── Завершення онлайн замовлення ────────────────────────────────
async function completeOnlineOrder(order: any, locationName: string, log: any) {
  if (order.status === 'COMPLETED') { log.info({ orderId: order.id }, 'Already completed'); return }

  try {
    const pts = await prisma.$transaction((tx: any) => awardCompletedOrderLoyalty(tx, {
      orderId: order.id,
      userId: order.userId,
      total: Number(order.total),
      userPoints: order.user.points,
    }))

    await prisma.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } })

    const updated = await prisma.user.findUnique({ where: { id: order.userId } })
    const bal = updated?.points || 0
    const lvl = getLevel(bal)
    const em: Record<string, string> = { Bronze: '\u{1f949}', Silver: '\u{1f948}', Gold: '\u{1f947}', Platinum: '\u{1f48e}' }
    const sep = '\u2500'.repeat(28)

    let itemLines = ''
    for (const item of order.items) {
      const name = item.product?.name || item.bundle?.name || 'Item'
      const price = Math.round(Number(item.price || 0))
      itemLines += '  ' + name + ' x' + item.quantity + '  ' + (price * item.quantity) + ' grn\n'
    }

    const text = [
      '\u{1f9fe} *\u0427\u0435\u043a #' + order.id + '*',
      sep,
      '\u{1f4cd} ' + locationName,
      sep,
      itemLines.trim(),
      sep,
      '\u{1f4b3} *\u0420\u0430\u0437\u043e\u043c: ' + Math.round(Number(order.total)) + ' \u0433\u0440\u043d*',
      sep,
      (em[lvl] || '') + ' *+' + pts + ' \u0431\u0430\u043b\u0456\u0432 \u043d\u0430\u0440\u0430\u0445\u043e\u0432\u0430\u043d\u043e*',
      '   \u0411\u0430\u043b\u0430\u043d\u0441: ' + bal + ' \u0431\u0430\u043b\u0456\u0432',
      sep,
      '_\u0414\u044f\u043a\u0443\u0454\u043c\u043e! \u041f\u0440\u0438\u0445\u043e\u0434\u044c\u0442\u0435 \u0437\u043d\u043e\u0432\u0443 \u2615_',
    ].join('\n')

    if (BOT) {
      await fetch('https://api.telegram.org/bot' + BOT + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: String(order.user.telegramId), text, parse_mode: 'Markdown' }),
      })
    }

    log.info({ orderId: order.id, pts, bal }, 'Online order COMPLETED + receipt sent')
  } catch (e) {
    log.error({ err: String(e), orderId: order.id }, 'completeOnlineOrder error')
  }
}      app.log.info({ transactionId: p.object_id }, 'Transaction CLOSED = order PAID')

      // Знаходимо активне замовлення на цій локації
      const order = await prisma.order.findFirst({
        where: {
          locationId: location.id,
          status: { in: ['SENT_TO_POS', 'ACCEPTED', 'PREPARING', 'READY'] },
        },
        include: {
          user: true,
          items: { include: { product: { select: { name: true } }, bundle: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      })

      if (!order) { app.log.warn({ locationId: location.id }, 'No active order found'); return }

      await completeOrder(order, location.name, app.log)
      return
    }

    // ── INCOMING ORDER CHANGED = відміна або зміна статусу ───────
    if (p.object === 'incoming_order' && p.action === 'changed') {
      if (!location.posterToken) { app.log.warn({ slug: location.slug }, 'No posterToken'); return }

      const posterOrderId = Number(p.object_id)
      const order = await prisma.order.findFirst({
        where: { posterOrderId, locationId: location.id },
        include: { user: true },
      })
      if (!order) { app.log.warn({ posterOrderId }, 'Order not found'); return }
      if (['CANCELLED', 'COMPLETED'].includes(order.status)) return

      // Перевіряємо статус в Poster API
      try {
        const url = `https://${p.account}.joinposter.com/api/incomingOrders.getIncomingOrder?token=${location.posterToken}&incoming_order_id=${posterOrderId}`
        const res = await fetch(url)
        const data = await res.json() as any
        const posterStatus = Number(data?.response?.status ?? 0)
        const transactionId = data?.response?.transaction_id
        app.log.info({ posterStatus, transactionId, orderId: order.id }, 'Poster incoming_order status')

        // status 7 БЕЗ transaction_id = відмінено (не оплачено)
        // status 7 З transaction_id = оплачено і закрито (резерв, якщо transaction:closed не прийшов)
        if (posterStatus === 7) {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
          await tgSend(String(order.user.telegramId), '\u274c \u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #' + order.id + ' \u0441\u043a\u0430\u0441\u043e\u0432\u0430\u043d\u043e \u0431\u0430\u0440\u0438\u0441\u0442\u043e\u044e.')
          app.log.info({ orderId: order.id, transactionId }, 'Order CANCELLED (status 7)')

        } else if (posterStatus === 2 && order.status === 'SENT_TO_POS') {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'ACCEPTED' } })
          await tgSend(String(order.user.telegramId), '\u2615 \u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #' + order.id + ' \u043f\u0440\u0438\u0439\u043d\u044f\u0442\u043e! \u0413\u043e\u0442\u0443\u0454\u043c\u043e...')
          app.log.info({ orderId: order.id }, 'Order ACCEPTED')

        } else {
          app.log.info({ posterStatus, transactionId }, 'incoming_order changed - no action')
        }
      } catch (e) {
        app.log.error({ err: String(e) }, 'Error checking Poster order status')
      }
      return
    }

    if (p.object === 'incoming_order' && p.action === 'added') {
      app.log.info({ posterOrderId: p.object_id }, 'incoming_order added - already tracked')
    }
  })
}

async function completeOrder(order: any, locationName: string, log: any) {
  if (order.status === 'COMPLETED') { log.info({ orderId: order.id }, 'Already completed'); return }

  try {
    const pts = await prisma.$transaction((tx: any) => awardCompletedOrderLoyalty(tx, {
      orderId: order.id,
      userId: order.userId,
      total: Number(order.total),
      userPoints: order.user.points,
    }))

    await prisma.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } })

    const updated = await prisma.user.findUnique({ where: { id: order.userId } })
    const bal = updated?.points || 0
    const lvl = bal >= 3000 ? 'Platinum' : bal >= 1000 ? 'Gold' : bal >= 300 ? 'Silver' : 'Bronze'
    const em: Record<string, string> = { Bronze: '\u{1f949}', Silver: '\u{1f948}', Gold: '\u{1f947}', Platinum: '\u{1f48e}' }
    const sep = '\u2500'.repeat(28)

    let itemLines = ''
    for (const item of order.items) {
      const name = item.product?.name || item.bundle?.name || 'Item'
      const price = Math.round(Number(item.price || 0))
      itemLines += '  ' + name + ' x' + item.quantity + '  ' + (price * item.quantity) + ' grn\n'
    }

    const text = [
      '\u{1f9fe} *\u0427\u0435\u043a #' + order.id + '*',
      sep,
      '\u{1f4cd} ' + locationName,
      sep,
      itemLines.trim(),
      sep,
      '\u{1f4b3} *\u0420\u0430\u0437\u043e\u043c: ' + Math.round(Number(order.total)) + ' \u0433\u0440\u043d*',
      sep,
      (em[lvl] || '') + ' *+' + pts + ' \u0431\u0430\u043b\u0456\u0432 \u043d\u0430\u0440\u0430\u0445\u043e\u0432\u0430\u043d\u043e*',
      '   \u0411\u0430\u043b\u0430\u043d\u0441: ' + bal + ' \u0431\u0430\u043b\u0456\u0432',
      sep,
      '_\u0414\u044f\u043a\u0443\u0454\u043c\u043e! \u041f\u0440\u0438\u0445\u043e\u0434\u044c\u0442\u0435 \u0437\u043d\u043e\u0432\u0443 \u2615_',
    ].join('\n')

    const BOT = process.env.BOT_TOKEN || ''
    if (BOT) {
      await fetch('https://api.telegram.org/bot' + BOT + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: String(order.user.telegramId), text, parse_mode: 'Markdown' }),
      })
    }

    log.info({ orderId: order.id, pts, bal }, 'Order COMPLETED + receipt sent')
  } catch (e) {
    log.error({ err: String(e), orderId: order.id }, 'completeOrder error')
  }
}
