import { FastifyInstance } from 'fastify'
import { prisma } from '../../lib/prisma'
import { awardCompletedOrderLoyalty } from '../../lib/orderRewards'

const BOT = process.env.BOT_TOKEN || ''
const API_URL = process.env.API_URL || 'https://server-production-1a00.up.railway.app'

async function tgSend(chatId: string, text: string) {
  if (!BOT) return
  try {
    await fetch('https://api.telegram.org/bot' + BOT + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch (e) { console.error('tgSend error:', e) }
}

// Fetch incoming order status from Poster API
async function getPosterOrderStatus(posterSubdomain: string, token: string, incomingOrderId: number): Promise<number | null> {
  try {
    const url = `https://${posterSubdomain}.joinposter.com/api/incomingOrders.getIncomingOrder?token=${token}&incoming_order_id=${incomingOrderId}`
    const res = await fetch(url)
    const data = await res.json() as any
    // status: 1=new, 2=accepted, 4=cancelled/deleted, 6=closed/paid
    return data?.response?.status ?? null
  } catch (e) {
    console.error('getPosterOrderStatus error:', e)
    return null
  }
}

export default async function posterWebhookRoutes(app: FastifyInstance) {

  app.post('/', async (req, reply) => {
    // Always respond 200 immediately
    reply.send({ success: true })

    const payload = req.body as any

    app.log.info({
      object: payload.object,
      action: payload.action,
      object_id: payload.object_id,
      account: payload.account,
    }, 'Poster webhook')

    if (!payload.account || !payload.object_id) return

    // Find our location by poster subdomain
    const location = await prisma.location.findFirst({
      where: { posterSubdomain: payload.account, hasPoster: true },
    })
    if (!location) {
      app.log.warn({ account: payload.account }, 'Location not found for webhook')
      return
    }

    // ── INCOMING ORDER ──────────────────────────────────────────────
    if (payload.object === 'incoming_order') {
      const posterOrderId = Number(payload.object_id)

      const order = await prisma.order.findFirst({
        where: { posterOrderId, locationId: location.id },
        include: { user: true, items: { include: { product: { select: { name: true } }, bundle: { select: { name: true } } } } },
      })

      if (!order) {
        app.log.warn({ posterOrderId }, 'Order not found in our DB')
        return
      }

      // action: "added" = new order created in Poster
      if (payload.action === 'added') {
        // Already handled when we created the order — nothing to do
        app.log.info({ orderId: order.id }, 'incoming_order added (already tracked)')
        return
      }

      // action: "changed" = status changed — check what happened via Poster API
      if (payload.action === 'changed') {
        // Get poster token for this location
        const posterToken = location.posterToken
        if (!posterToken) {
          app.log.warn({ locationId: location.id }, 'No poster token for location')
          return
        }

        const posterStatus = await getPosterOrderStatus(payload.account, posterToken, posterOrderId)
        app.log.info({ posterStatus, orderId: order.id }, 'Poster order status')

        // status 6 = closed/paid
        if (posterStatus === 6 && order.status !== 'COMPLETED') {
          const pts = await prisma.$transaction((tx: any) => awardCompletedOrderLoyalty(tx, {
            orderId: order.id,
            userId: order.userId,
            total: Number(order.total),
            userPoints: order.user.points,
          }))

          await prisma.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } })

          if (pts > 0) {
            const updatedUser = await prisma.user.findUnique({ where: { id: order.userId } })
            const userPoints = updatedUser?.points || 0
            const level = userPoints >= 3000 ? 'Platinum' : userPoints >= 1000 ? 'Gold' : userPoints >= 300 ? 'Silver' : 'Bronze'
            const lvlMap: Record<string, string> = { Bronze: '\u{1f949}', Silver: '\u{1f948}', Gold: '\u{1f947}', Platinum: '\u{1f48e}' }
            const lvlEmoji = lvlMap[level] || '\u2615'
            const sep = '\u2500'.repeat(28)

            let itemLines = ''
            for (const item of order.items) {
              const name = item.product?.name || item.bundle?.name || 'Item'
              const price = Math.round(Number(item.price || 0))
              const qty = item.quantity
              itemLines += '  ' + name + ' x' + qty + '  ' + (price * qty) + ' grn\n'
            }

            const receiptLines = [
              '\u{1f9fe} *\u0427\u0435\u043a #' + order.id + '*',
              sep,
              '\u{1f4cd} ' + location.name,
              sep,
              itemLines.trim(),
              sep,
              '\u{1f4b3} *\u0420\u0430\u0437\u043e\u043c: ' + Math.round(Number(order.total)) + ' \u0433\u0440\u043d*',
              sep,
              lvlEmoji + ' *+' + pts + ' \u0431\u0430\u043b\u0456\u0432 \u043d\u0430\u0440\u0430\u0445\u043e\u0432\u0430\u043d\u043e*',
              '   \u0411\u0430\u043b\u0430\u043d\u0441: ' + userPoints + ' \u0431\u0430\u043b\u0456\u0432',
              sep,
              '_\u0414\u044f\u043a\u0443\u0454\u043c\u043e! \u041f\u0440\u0438\u0445\u043e\u0434\u044c\u0442\u0435 \u0437\u043d\u043e\u0432\u0443 \u2615_',
            ]

            await tgSend(String(order.user.telegramId), receiptLines.join('\n'))
          }

          app.log.info({ orderId: order.id, pts }, 'Order COMPLETED via webhook')
          return
        }

        // status 4 = cancelled/deleted
        if (posterStatus === 4 && !['CANCELLED', 'COMPLETED'].includes(order.status)) {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
          await tgSend(String(order.user.telegramId),
            '\u274c \u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #' + order.id + ' \u0441\u043a\u0430\u0441\u043e\u0432\u0430\u043d\u043e \u0431\u0430\u0440\u0438\u0441\u0442\u043e\u044e.'
          )
          app.log.info({ orderId: order.id }, 'Order CANCELLED via webhook')
          return
        }

        // status 2 = accepted by barista
        if (posterStatus === 2 && order.status === 'SENT_TO_POS') {
          await prisma.order.update({ where: { id: order.id }, data: { status: 'ACCEPTED' } })
          await tgSend(String(order.user.telegramId),
            '\u2615 \u0417\u0430\u043c\u043e\u0432\u043b\u0435\u043d\u043d\u044f #' + order.id + ' \u043f\u0440\u0438\u0439\u043d\u044f\u0442\u043e! \u0413\u043e\u0442\u0443\u0454\u043c\u043e \u0442\u0432\u043e\u044e \u043a\u0430\u0432\u0443...'
          )
          app.log.info({ orderId: order.id }, 'Order ACCEPTED via webhook')
          return
        }

        app.log.info({ posterStatus, orderId: order.id }, 'incoming_order changed — no action taken')
      }
    }
  })
}
