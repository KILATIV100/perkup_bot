import { FastifyInstance } from 'fastify'
import crypto from 'crypto'
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
  } catch {}
}

export default async function posterWebhookRoutes(app: FastifyInstance) {

  app.post('/', async (req, reply) => {
    const payload = req.body as any

    // Log everything to understand what Poster sends
    app.log.info({
      object: payload.object,
      action: payload.action,
      account: payload.account,
      data: JSON.stringify(payload.data || {}).slice(0, 300),
    }, 'Poster webhook received')

    const accountName = payload.account || ''
    if (!accountName) return reply.send({ success: true })

    const location = await prisma.location.findFirst({
      where: { posterSubdomain: accountName, hasPoster: true }
    })
    if (!location) {
      app.log.warn({ accountName }, 'Poster webhook: location not found')
      return reply.send({ success: true })
    }

    // Signature check — log only
    const signature = req.headers['x-poster-hook-signature'] as string | undefined
    if (signature && location.posterToken) {
      const expected = crypto.createHmac('md5', location.posterToken).update(JSON.stringify(payload)).digest('hex')
      if (signature !== expected) {
        app.log.warn({ locationId: location.id }, 'Poster webhook: invalid signature')
      }
    }

    // ─── INCOMING ORDER: CLOSED (оплачено) ─────────────────────────
    if (payload.object === 'incoming_order' && payload.action === 'closed') {
      const posterOrderId = parseInt(String(payload.data?.incoming_order_id ?? ''), 10)
      if (!posterOrderId || isNaN(posterOrderId)) return reply.send({ success: true })

      const order = await prisma.order.findFirst({
        where: { posterOrderId, locationId: location.id },
        include: { user: true },
      })

      if (!order) {
        app.log.warn({ posterOrderId }, 'Poster webhook: order not found for closed')
        return reply.send({ success: true })
      }

      if (order.status !== 'COMPLETED') {
        await prisma.$transaction(async (tx: any) => {
          await tx.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } })
          await awardCompletedOrderLoyalty(tx, {
            orderId: order.id,
            userId: order.userId,
            total: Number(order.total),
            userPoints: order.user.points,
          })
        })
        app.log.info({ orderId: order.id }, 'Order COMPLETED + points awarded via webhook')
      }
    }

    // ─── INCOMING ORDER: DELETED/CANCELLED (відмінено) ─────────────
    if (payload.object === 'incoming_order' &&
        (payload.action === 'deleted' || payload.action === 'cancelled' || payload.action === 'removed')) {

      const posterOrderId = parseInt(String(
        payload.data?.incoming_order_id ??
        payload.data?.id ??
        ''
      ), 10)

      if (!posterOrderId || isNaN(posterOrderId)) return reply.send({ success: true })

      const order = await prisma.order.findFirst({
        where: { posterOrderId, locationId: location.id },
        include: { user: true },
      })

      if (!order) {
        app.log.warn({ posterOrderId }, 'Poster webhook: order not found for cancel')
        return reply.send({ success: true })
      }

      const CANCELLABLE = ['PENDING', 'SENT_TO_POS', 'ACCEPTED', 'PREPARING', 'READY', 'UNASSIGNED']
      if (!CANCELLABLE.includes(order.status)) return reply.send({ success: true })

      await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })

      // Notify user via Telegram
      await tgSend(String(order.user.telegramId),
        `❌ Замовлення #${order.id} скасовано баристою.\nЯкщо є питання — зверніться до нас.`
      )

      app.log.info({ orderId: order.id }, 'Order CANCELLED via webhook')
    }

    // ─── TRANSACTION: оплата через Poster (якщо є) ─────────────────
    if (payload.object === 'transaction' && payload.action === 'create') {
      app.log.info({ data: payload.data }, 'Poster transaction webhook')
    }

    return reply.send({ success: true })
  })

  // Legacy
  app.post('/:locationId', async (_req, reply) => reply.send({ success: true }))
}
