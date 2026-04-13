import { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import { prisma } from '../../lib/prisma'
import { awardCompletedOrderLoyalty } from '../../lib/orderRewards'

export default async function posterWebhookRoutes(app: FastifyInstance) {
  app.post('/', async (req, reply) => {
    const payload = req.body as any
    
    app.log.info({ payload: JSON.stringify(payload).slice(0, 500) }, 'Poster webhook received')

    // Determine location by account name (posterSubdomain)
    const accountName = payload.account || ''
    
    if (!accountName) {
      app.log.warn('Poster webhook: no account in payload')
      return reply.send({ success: true })
    }

    const location = await prisma.location.findFirst({
      where: { posterSubdomain: accountName, hasPoster: true }
    })

    if (!location) {
      app.log.warn({ accountName }, 'Poster webhook: location not found')
      return reply.send({ success: true })
    }

    // Verify signature if present
    const signature = req.headers['x-poster-hook-signature'] as string | undefined
    if (signature && location.posterToken) {
      const rawBody = JSON.stringify(payload)
      const expected = crypto.createHmac('md5', location.posterToken).update(rawBody).digest('hex')
      if (signature !== expected) {
        app.log.warn({ locationId: location.id }, 'Invalid Poster webhook signature')
        // Don't reject — just log warning, proceed anyway
      }
    }

    if (payload.object === 'incoming_order' && payload.action === 'closed') {
      const posterOrderId = parseInt(String(payload.data?.incoming_order_id ?? ''), 10)
      if (!posterOrderId || isNaN(posterOrderId)) return reply.send({ success: true })

      const order = await prisma.order.findFirst({
        where: { posterOrderId, locationId: location.id },
        include: { user: true },
      })

      if (!order) {
        app.log.warn({ posterOrderId, locationId: location.id }, 'Poster webhook: order not found')
        return reply.send({ success: true })
      }

      if (order.status !== 'COMPLETED') {
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: { status: 'COMPLETED' },
          })
          await awardCompletedOrderLoyalty(tx, {
            orderId: order.id,
            userId: order.userId,
            total: Number(order.total),
            userPoints: order.user.points,
          })
        })
        app.log.info({ orderId: order.id, locationId: location.id }, 'Order COMPLETED + points awarded')
      }
    }

    return reply.send({ success: true })
  })

  // Keep old route for backward compatibility  
  app.post('/:locationId', async (req, reply) => {
    return reply.send({ success: true })
  })
}
