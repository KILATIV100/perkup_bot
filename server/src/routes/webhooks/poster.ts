import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { awardCompletedOrderLoyalty } from '../../lib/orderRewards'

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

async function getTransactionAction(posterSubdomain: string, token: string, transactionId: number, log: any): Promise<string | null> {
  try {
    const url = `https://${posterSubdomain}.joinposter.com/api/transactions.getTransactionHistory?token=${token}&transaction_id=${transactionId}`
    log.info({ url: url.replace(token, '***') }, 'Fetching transaction history')
    const res = await fetch(url)
    const raw = await res.text()
    log.info({ raw: raw.slice(0, 300) }, 'Transaction history response')
    const data = JSON.parse(raw) as any
    return data?.response?.type_history ?? null
  } catch (e) {
    log.error({ err: String(e) }, 'getTransactionAction error')
    return null
  }
}

export default async function posterWebhookRoutes(app: FastifyInstance) {

  // ── TRANSACTION webhook — найнадійніший спосіб визначити оплату ──
  // transaction action: "closed" = оплачено, "changed" = зміна
  // incoming_order action: "added" = нове, "changed" = будь-яка зміна (в т.ч. відміна)

  app.post('/', async (req, reply) => {
    reply.send({ success: true })

    const p = req.body as any
    app.log.info({
      object: p.object,
      action: p.action,
      object_id: p.object_id,
      account: p.account,
    }, 'Poster webhook received')

    if (!p.account || !p.object_id) return

    // Find location
    const location = await prisma.location.findFirst({
      where: { posterSubdomain: p.account, hasPoster: true },
    })
    if (!location) { app.log.warn({ account: p.account }, 'Location not found'); return }

    // ── TRANSACTION: closed = оплачено ────────────────────────────
    if (p.object === 'transaction' && p.action === 'closed') {
      app.log.info({ transactionId: p.object_id }, 'Transaction CLOSED = order paid')

      // Find order by transaction_id (posterOrderId is the incoming_order_id, transaction_id is separate)
      // Try to find via data field
      let incomingOrderId: number | null = null
      try {
        const data = typeof p.data === 'string' ? JSON.parse(p.data) : p.data
        // data contains transaction info - need to find incoming_order via API
      } catch {}

      // Search order by location that is SENT_TO_POS or ACCEPTED (active)
      const recentOrder = await prisma.order.findFirst({
        where: {
          locationId: location.id,
          status: { in: ['SENT_TO_POS', 'ACCEPTED', 'PREPARING', 'READY'] },
        },
        include: { user: true, items: { include: { product: { select: { name: true } }, bundle: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
      })

      if (!recentOrder) {
        app.log.warn({ locationId: location.id }, 'No active order found for transaction closed')
        return
      }

      await completeOrder(recentOrder, location.name, app.log)
      return
    }

    // ── INCOMING ORDER: changed = відміна або зміна статусу ───────
    if (p.object === 'incoming_order' && p.action === 'changed') {
      if (!location.posterToken) { app.log.warn({ slug: location.slug }, 'No posterToken'); return }

      const posterOrderId = Number(p.object_id)
      const order = await prisma.order.findFirst({
        where: { posterOrderId, locationId: location.id },
        include: { user: true, items: { include: { product: { select: { name: true } }, bundle: { select: { name: true } } } } },
      })
      if (!order) { app.log.warn({ posterOrderId }, 'Order not found'); return }
      if (['CANCELLED', 'COMPLETED'].includes(order.status)) return

      // Fetch real status from Poster
      const url = `https://${p.account}.joinposter.com/api/incomingOrders.getIncomingOrder?token=${location.posterToken}&incoming_order_id=${posterOrderId}`
      try {
        const res = await fetch(url)
        const raw = await res.text()
        const data = JSON.parse(raw) as any
        const posterStatus = Number(data?.response?.status ?? 0)
        app.log.info({ posterStatus, orderId: order.id }, 'Poster incoming_order status')

        // status 7 = cancelled when no transaction (відміна без оплати)
        // status 6 = closed/paid (якщо не спрацював transaction webhook)
        if ((posterStatus === 7 || posterStatus === 4) && !data?.response?.transaction_id) {
          // Cancelled - no transaction means not paid
          await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
          await tgSend(String(order.user.telegramId), '\u274c \u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #' + order.id + ' \u0441\u043a\u0430\u0441\u043e\u0432\u0430\u043d\u043e \u0431\u0430\u0440\u0438\u0441\u0442\u043e\u044e.')
          app.log.info({ orderId: order.id, posterStatus }, 'Order CANCELLED')
        } else if (posterStatus === 7 && data?.response?.transaction_id) {
          // status 7 WITH transaction_id = paid and closed
          app.log.info({ orderId: order.id, transactionId: data.response.transaction_id }, 'Order PAID (status 7 + transaction_id)')
          await completeOrder(order, location.name, app.log)
        } else if (posterStatus === 2 && order.status === 'SENT_TO_POS') {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'ACCEPTED' } })
          await tgSend(String(order.user.telegramId), '\u2615 \u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #' + order.id + ' \u043f\u0440\u0438\u0439\u043d\u044f\u0442\u043e! \u0413\u043e\u0442\u0443\u0454\u043c\u043e...')
          app.log.info({ orderId: order.id }, 'Order ACCEPTED')
        } else {
          app.log.info({ posterStatus, transactionId: data?.response?.transaction_id }, 'No matching transition')
        }
      } catch (e) {
        app.log.error({ err: String(e) }, 'Error fetching Poster order')
      }
      return
    }

    // ── INCOMING ORDER: added = нове (вже обробили при створенні) ─
    if (p.object === 'incoming_order' && p.action === 'added') {
      app.log.info({ posterOrderId: p.object_id }, 'incoming_order added - already tracked')
    }
  })
}

async function completeOrder(order: any, locationName: string, log: any) {
  if (order.status === 'COMPLETED') return

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

    const BOT = process.env.BOT_TOKEN || ''
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

    log.info({ orderId: order.id, pts, bal }, 'Order COMPLETED + receipt sent')
  } catch (e) {
    log.error({ err: String(e), orderId: order.id }, 'completeOrder error')
  }
}
