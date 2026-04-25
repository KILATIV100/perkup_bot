import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { awardCompletedOrderLoyalty } from '../../lib/orderRewards'
import { calcEarnedPoints, getLevel } from '../../lib/loyalty'
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

const SEP = '\u2500'.repeat(28)
const EM: Record<string, string> = {
  Bronze: '\ud83e\udd49',
  Silver: '\ud83e\udd48',
  Gold: '\ud83e\udd47',
  Platinum: '\ud83d\udc8e',
}

function buildReceipt(orderId: number, locationName: string, itemLines: string, total: number, pts: number, bal: number, level: string): string {
  const lvlEmoji = EM[level] || '\u2615'
  return [
    '\ud83e\uddfe *\u0427\u0435\u043a #' + orderId + '*',
    SEP,
    '\ud83d\udccd ' + locationName,
    SEP,
    itemLines,
    SEP,
    '\ud83d\udcb3 *\u0420\u0430\u0437\u043e\u043c: ' + Math.round(total) + ' \u0433\u0440\u043d*',
    SEP,
    lvlEmoji + ' *+' + pts + ' \u0431\u0430\u043b\u0456\u0432 \u043d\u0430\u0440\u0430\u0445\u043e\u0432\u0430\u043d\u043e*',
    '   \u0411\u0430\u043b\u0430\u043d\u0441: ' + bal + ' \u0431\u0430\u043b\u0456\u0432',
    SEP,
    '_\u0414\u044f\u043a\u0443\u0454\u043c\u043e! \u041f\u0440\u0438\u0445\u043e\u0434\u044c\u0442\u0435 \u0437\u043d\u043e\u0432\u0443 \u2615_',
  ].join('\n')
}

function toNum(v: any): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function extractDeterministicPosterOrderIdFromTransactionChanged(payload: any): number | null {
  const candidates = [
    payload?.incoming_order_id,
    payload?.incomingOrderId,
    payload?.data?.incoming_order_id,
    payload?.data?.incomingOrderId,
    payload?.value_text?.incoming_order_id,
    payload?.value_text?.incomingOrderId,
    payload?.transactions_history?.incoming_order_id,
    payload?.transactions_history?.incomingOrderId,
  ]
  for (const c of candidates) {
    const parsed = toNum(c)
    if (parsed && parsed > 0) return parsed
  }
  return null
}

async function findUserByPosterTransaction(subdomain: string, token: string, transactionId: number, log: any): Promise<{ normalizedPhone: string | null; userId: number | null; telegramId: bigint | null }> {
  try {
    const url = 'https://' + subdomain + '.joinposter.com/api/transactions.getTransactionById?token=' + token + '&transaction_id=' + transactionId
    const res = await fetch(url)
    const data = await res.json() as any
    log.info({ transactionId, keys: Object.keys(data?.response || {}) }, 'Poster transaction keys')

    let normalizedPhone: string | null = null
    const phone = data?.response?.client_phone || data?.response?.phone
    if (phone) {
      normalizedPhone = normalizePhone(String(phone))
      if (normalizedPhone) {
        const user = await prisma.user.findFirst({ where: { phone: normalizedPhone } })
        if (user) { log.info({ userId: user.id }, 'Found user by phone'); return { normalizedPhone, userId: user.id, telegramId: user.telegramId } }
      }
    }

    const clientId = data?.response?.client_id
    if (clientId) {
      const clientUrl = 'https://' + subdomain + '.joinposter.com/api/clients.getClient?token=' + token + '&client_id=' + clientId
      const clientRes = await fetch(clientUrl)
      const clientData = await clientRes.json() as any
      const clientPhone = clientData?.response?.phone
      if (clientPhone) {
        normalizedPhone = normalizePhone(String(clientPhone))
        if (normalizedPhone) {
          const user = await prisma.user.findFirst({ where: { phone: normalizedPhone } })
          if (user) { log.info({ userId: user.id }, 'Found user by Poster client phone'); return { normalizedPhone, userId: user.id, telegramId: user.telegramId } }
        }
      }
    }

    log.info({ transactionId }, 'No PerkUp user found for this Poster transaction')
    return { normalizedPhone, userId: null, telegramId: null }
  } catch (e) {
    log.error({ err: String(e) }, 'findUserByPosterTransaction error')
    return { normalizedPhone: null, userId: null, telegramId: null }
  }
}

async function awardOfflinePoints(userId: number, totalGrn: number, transactionId: number, locationName: string, log: any): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return 0

  const key = 'earn:offline-poster:' + locationName + ':' + transactionId
  const existing = await prisma.pointsTransaction.findFirst({ where: { idempotencyKey: key } })
  if (existing) { log.info({ transactionId }, 'Offline points already awarded'); return 0 }

  const pts = calcEarnedPoints(totalGrn, user.points)
  if (pts <= 0) return 0

  await prisma.$transaction(async (tx: any) => {
    await tx.pointsTransaction.create({
      data: {
        userId,
        amount: pts,
        type: 'ORDER',
        description: '\u0411\u0430\u043b\u0438 \u0437\u0430 \u043e\u0444\u043b\u0430\u0439\u043d \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f: ' + locationName + ' (Poster #' + transactionId + ')',
        idempotencyKey: key,
      },
    })
    await tx.user.update({
      where: { id: userId },
      data: { points: { increment: pts }, monthlyOrders: { increment: 1 } },
    })
  })

  log.info({ userId, pts, transactionId }, 'Offline points awarded')
  return pts
}

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

    let itemLines = ''
    for (const item of order.items) {
      const name = item.product?.name || item.bundle?.name || 'Item'
      const price = Math.round(Number(item.price || 0))
      itemLines += '  ' + name + ' x' + item.quantity + '  ' + (price * item.quantity) + ' grn\n'
    }

    const text = buildReceipt(order.id, locationName, itemLines.trim(), Number(order.total), pts, bal, lvl)
    await tgSend(String(order.user.telegramId), text)
    log.info({ orderId: order.id, pts, bal }, 'Online order COMPLETED + receipt sent')
  } catch (e) {
    log.error({ err: String(e), orderId: order.id }, 'completeOnlineOrder error')
  }
}

export default async function posterWebhookRoutes(app: FastifyInstance) {

  app.post('/', async (req, reply) => {
    reply.send({ success: true })

    const p = req.body as any
    app.log.info({
      event: 'POSTER_WEBHOOK_INTAKE',
      object: p?.object || null,
      action: p?.action || null,
      object_id: p?.object_id ?? null,
      account: p?.account || null,
      hasAccount: Boolean(p?.account),
      hasObjectId: p?.object_id !== undefined && p?.object_id !== null,
    }, 'POSTER_WEBHOOK_INTAKE')

    if (!p.account || !p.object_id) {
      app.log.info({
        event: 'POSTER_BRANCH_IGNORED',
        reason: 'missing_account_or_object_id',
        object: p?.object || null,
        action: p?.action || null,
        account: p?.account || null,
        object_id: p?.object_id ?? null,
      }, 'POSTER_BRANCH_IGNORED')
      return
    }

    const location = await prisma.location.findFirst({
      where: { posterSubdomain: p.account, hasPoster: true },
    })
    app.log.info({
      event: 'POSTER_WEBHOOK_LOCATION_MATCH',
      account: p.account,
      matched: Boolean(location),
      locationId: location?.id || null,
      locationSlug: location?.slug || null,
      hasPoster: location?.hasPoster || false,
    }, 'POSTER_WEBHOOK_LOCATION_MATCH')
    if (!location) {
      app.log.warn({
        event: 'POSTER_BRANCH_IGNORED',
        reason: 'location_not_found',
        account: p.account,
        object: p.object,
        action: p.action,
        object_id: p.object_id,
      }, 'POSTER_BRANCH_IGNORED')
      return
    }

    // TRANSACTION CLOSED = paid
    if (p.object === 'transaction' && p.action === 'closed') {
      app.log.info({
        event: 'POSTER_BRANCH_TRANSACTION_CLOSED',
        account: p.account,
        object_id: p.object_id,
        locationId: location.id,
      }, 'POSTER_BRANCH_TRANSACTION_CLOSED')
      app.log.info({ transactionId: p.object_id }, 'Transaction CLOSED = PAID')

      // First: check for online order
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

      // No online order: offline Poster client
      if (!location.posterToken) { app.log.warn({ slug: location.slug }, 'No posterToken'); return }

      app.log.info({ transactionId: p.object_id }, 'No online order - checking offline Poster client')

      try {
        const txUrl = 'https://' + p.account + '.joinposter.com/api/transactions.getTransactionById?token=' + location.posterToken + '&transaction_id=' + p.object_id
        const txRes = await fetch(txUrl)
        const txData = await txRes.json() as any
        const totalKopecks = Number(txData?.response?.sum || txData?.response?.total_sum || 0)
        const totalGrn = totalKopecks / 100
        app.log.info({ totalGrn, transactionId: p.object_id }, 'Offline transaction total')

        if (totalGrn <= 0) { app.log.info({}, 'No total in offline transaction'); return }

        const userInfo = await findUserByPosterTransaction(p.account, location.posterToken, Number(p.object_id), app.log)
        const pointsForCheck = calcEarnedPoints(totalGrn, 0)
        if (pointsForCheck <= 0) return

        if (!userInfo.userId) {
          if (!userInfo.normalizedPhone) {
            app.log.warn({ posterTransactionId: p.object_id }, 'Poster transaction has no phone, skipping offline loyalty accrual')
            return
          }
          await prisma.pendingLoyaltyEvent.upsert({
            where: { posterAccountId_posterTransactionId: { posterAccountId: p.account, posterTransactionId: String(p.object_id) } },
            update: {},
            create: {
              phone: userInfo.normalizedPhone,
              locationId: location.id,
              posterAccountId: p.account,
              posterTransactionId: String(p.object_id),
              totalAmount: Math.round(totalGrn * 100),
              points: pointsForCheck,
            },
          })
          app.log.info({ phone: userInfo.normalizedPhone, points: pointsForCheck }, 'Pending loyalty event created')
          return
        }

        const pts = await awardOfflinePoints(userInfo.userId, totalGrn, Number(p.object_id), p.account, app.log)
        if (pts <= 0) return

        const updated = await prisma.user.findUnique({ where: { id: userInfo.userId } })
        const bal = updated?.points || 0
        const lvl = getLevel(bal)
        const lvlEmoji = EM[lvl] || '\u2615'

        const text = [
          '\ud83e\uddfe *\u041e\u0444\u043b\u0430\u0439\u043d \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f*',
          SEP,
          '\ud83d\udccd ' + location.name,
          SEP,
          '\ud83d\udcb3 *\u0421\u0443\u043c\u0430: ' + Math.round(totalGrn) + ' \u0433\u0440\u043d*',
          SEP,
          lvlEmoji + ' *+' + pts + ' \u0431\u0430\u043b\u0456\u0432 \u043d\u0430\u0440\u0430\u0445\u043e\u0432\u0430\u043d\u043e*',
          '   \u0411\u0430\u043b\u0430\u043d\u0441: ' + bal + ' \u0431\u0430\u043b\u0456\u0432',
          SEP,
          '_\u0414\u044f\u043a\u0443\u0454\u043c\u043e! \u041f\u0440\u0438\u0445\u043e\u0434\u044c\u0442\u0435 \u0437\u043d\u043e\u0432\u0443 \u2615_',
        ].join('\n')

        if (userInfo.telegramId) {
          await tgSend(String(userInfo.telegramId), text)
          app.log.info({ userId: userInfo.userId, pts }, 'Offline order: Telegram sent')
        }
      } catch (e) {
        app.log.error({ err: String(e) }, 'Offline order processing error')
      }
      return
    }

    // INCOMING ORDER CHANGED = status change
    if (p.object === 'incoming_order' && p.action === 'changed') {
      app.log.info({
        event: 'POSTER_BRANCH_INCOMING_ORDER_CHANGED',
        account: p.account,
        object_id: p.object_id,
        locationId: location.id,
      }, 'POSTER_BRANCH_INCOMING_ORDER_CHANGED')
      if (!location.posterToken) return

      const posterOrderId = Number(p.object_id)
      const order = await prisma.order.findFirst({
        where: { posterOrderId, locationId: location.id },
        include: { user: true },
      })

      try {
        const url = 'https://' + p.account + '.joinposter.com/api/incomingOrders.getIncomingOrder?token=' + location.posterToken + '&incoming_order_id=' + posterOrderId
        const res = await fetch(url)
        const data = await res.json() as any
        const posterStatus = Number(data?.response?.status ?? 0)
        const transactionId = data?.response?.transaction_id
        app.log.info({
          posterOrderId,
          perkupOrderFound: Boolean(order),
          currentOrderStatus: order?.status || null,
          posterStatus,
          transactionId,
        }, 'Poster incoming_order changed lookup')

        if (!order) {
          app.log.warn({ posterOrderId, posterStatus, transactionId }, 'PerkUp order not found for incoming_order changed')
          return
        }
        if (['CANCELLED', 'COMPLETED'].includes(order.status)) {
          app.log.info({ orderId: order.id, currentOrderStatus: order.status }, 'Skipping incoming_order change for terminal order')
          return
        }

        if (posterStatus === 7) {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
          await tgSend(String(order.user.telegramId), [
            '\u274c *\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #' + order.id + ' \u0441\u043a\u0430\u0441\u043e\u0432\u0430\u043d\u043e*',
            '\u0411\u0430\u0440\u0438\u0441\u0442\u0430 \u0432\u0456\u0434\u043c\u0456\u043d\u0438\u0432 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f. \u042f\u043a\u0449\u043e \u0446\u0435 \u043f\u043e\u043c\u0438\u043b\u043a\u0430 \u2014 \u0437\u0432\u0435\u0440\u043d\u0456\u0442\u044c\u0441\u044f \u0434\u043e \u0431\u0430\u0440\u0438\u0441\u0442\u0438.',
          ].join('\n'))
          app.log.info({ orderId: order.id, posterOrderId, posterStatus, transactionId }, 'Order CANCELLED from incoming_order status=7')
        } else if (posterStatus === 2 && order.status === 'SENT_TO_POS') {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'ACCEPTED' } })
          await tgSend(String(order.user.telegramId), [
            '\u2615 *\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #' + order.id + ' \u043f\u0440\u0438\u0439\u043d\u044f\u0442\u043e!*',
            '\u0411\u0430\u0440\u0438\u0441\u0442\u0430 \u043f\u043e\u0447\u0438\u043d\u0430\u0454 \u0433\u043e\u0442\u0443\u0432\u0430\u0442\u0438 \u0432\u0430\u0448\u0435 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f \u2615',
          ].join('\n'))
          app.log.info({ orderId: order.id }, 'Order ACCEPTED')
        } else if (posterStatus === 3 && ['SENT_TO_POS', 'ACCEPTED'].includes(order.status)) {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'PREPARING' } })
          await tgSend(String(order.user.telegramId), [
            '\u2615 *\u0413\u043e\u0442\u0443\u0454\u043c\u043e \u0432\u0430\u0448\u0435 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #' + order.id + '*',
            '\u0421\u043a\u043e\u0440\u043e \u0431\u0443\u0434\u0435 \u0433\u043e\u0442\u043e\u0432\u043e \u2014 \u0447\u0435\u043a\u0430\u0439\u0442\u0435!',
          ].join('\n'))
          app.log.info({ orderId: order.id }, 'Order PREPARING')
        } else if ((posterStatus === 4 || posterStatus === 5) && ['SENT_TO_POS', 'ACCEPTED', 'PREPARING'].includes(order.status)) {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'READY' } })
          await tgSend(String(order.user.telegramId), [
            '\ud83c\udf89 *\u0412\u0430\u0448\u0435 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #' + order.id + ' \u0433\u043e\u0442\u043e\u0432\u0435!*',
            '\u041f\u0456\u0434\u0456\u0439\u0434\u0456\u0442\u044c \u0434\u043e \u043a\u0430\u0441\u0438 \u0456 \u0437\u0430\u0431\u0435\u0440\u0456\u0442\u044c \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f',
          ].join('\n'))
          app.log.info({ orderId: order.id }, 'Order READY')
        } else {
          app.log.info({ posterStatus, transactionId }, 'No matching transition')
        }
      } catch (e) {
        app.log.error({ err: String(e) }, 'Error checking Poster order status')
      }
      return
    }

    // TRANSACTION CHANGED (changeorderstatus) = fallback cancel signal
    if (p.object === 'transaction' && p.action === 'changed') {
      app.log.info({
        event: 'POSTER_BRANCH_TRANSACTION_CHANGED',
        account: p.account,
        object_id: p.object_id,
        locationId: location.id,
        type_history: p?.transactions_history?.type_history || p?.data?.type_history || null,
      }, 'POSTER_BRANCH_TRANSACTION_CHANGED')
      const historyType = String(p?.transactions_history?.type_history || p?.data?.type_history || '')
      const value = toNum(p?.transactions_history?.value ?? p?.value)
      const value2 = toNum(p?.transactions_history?.value2 ?? p?.value2)

      if (historyType !== 'changeorderstatus' || value !== 4 || value2 !== 5) return

      const posterOrderId = extractDeterministicPosterOrderIdFromTransactionChanged(p)
      if (!posterOrderId) {
        app.log.info({
          transactionId: p.object_id,
          historyType,
          value,
          value2,
        }, 'Skip fallback cancel: no deterministic incoming_order_id in transaction payload')
        return
      }

      const order = await prisma.order.findFirst({
        where: { posterOrderId, locationId: location.id },
        include: { user: true },
      })
      if (!order) {
        app.log.warn({ posterOrderId, transactionId: p.object_id }, 'Skip fallback cancel: PerkUp order not found')
        return
      }
      if (['CANCELLED', 'COMPLETED'].includes(order.status)) {
        app.log.info({ orderId: order.id, currentOrderStatus: order.status }, 'Skip fallback cancel: order already terminal')
        return
      }

      await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
      await tgSend(String(order.user.telegramId), [
        '\u274c *\u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #' + order.id + ' \u0441\u043a\u0430\u0441\u043e\u0432\u0430\u043d\u043e*',
        '\u0411\u0430\u0440\u0438\u0441\u0442\u0430 \u0432\u0456\u0434\u043c\u0456\u043d\u0438\u0432 \u0437\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f. \u042f\u043a\u0449\u043e \u0446\u0435 \u043f\u043e\u043c\u0438\u043b\u043a\u0430 \u2014 \u0437\u0432\u0435\u0440\u043d\u0456\u0442\u044c\u0441\u044f \u0434\u043e \u0431\u0430\u0440\u0438\u0441\u0442\u0438.',
      ].join('\n'))
      app.log.info({ orderId: order.id, posterOrderId, transactionId: p.object_id }, 'Order CANCELLED from transaction changeorderstatus fallback')
      return
    }

    if (p.object === 'incoming_order' && p.action === 'added') {
      app.log.info({ posterOrderId: p.object_id }, 'incoming_order added - already tracked')
      app.log.info({
        event: 'POSTER_BRANCH_IGNORED',
        reason: 'incoming_order_added',
        account: p.account,
        object_id: p.object_id,
        locationId: location.id,
      }, 'POSTER_BRANCH_IGNORED')
      return
    }

    if (p.object === 'incoming_order' && p.action === 'closed') {
      app.log.info({
        event: 'POSTER_BRANCH_INCOMING_ORDER_CLOSED',
        account: p.account,
        object_id: p.object_id,
        locationId: location.id,
      }, 'POSTER_BRANCH_INCOMING_ORDER_CLOSED')
      return
    }

    app.log.info({
      event: 'POSTER_BRANCH_IGNORED',
      reason: 'no_matching_branch',
      account: p.account,
      object: p.object,
      action: p.action,
      object_id: p.object_id,
      locationId: location.id,
    }, 'POSTER_BRANCH_IGNORED')
  })
}
