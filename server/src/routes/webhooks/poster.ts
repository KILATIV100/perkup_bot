import { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import { prisma } from '../../lib/prisma'
import { awardCompletedOrderLoyalty } from '../../lib/orderRewards'

export default async function posterWebhookRoutes(app: FastifyInstance) {
  app.post('/:locationId', async (req, reply) => {
    const { locationId } = req.params as { locationId: string }
    const payload = req.body as any

    const locationIdNum = Number(locationId)
    if (!Number.isFinite(locationIdNum)) {
      return reply.code(400).send({ success: false, error: 'Invalid location id' })
    }

    const location = await prisma.location.findUnique({ where: { id: locationIdNum } })
    if (!location || !location.hasPoster) {
      return reply.code(400).send({ success: false, error: 'Invalid location' })
    }

    const signature = req.headers['x-poster-hook-signature'] as string | undefined
    if (signature && location.posterToken) {
      const rawBody = JSON.stringify(payload)
      const expected = crypto.createHmac('md5', location.posterToken).update(rawBody).digest('hex')
      if (signature !== expected) {
        app.log.warn({ locationId: location.id }, 'Invalid Poster webhook signature')
        return reply.code(401).send({ success: false, error: 'Invalid signature' })
      }
    }

    if (payload.object === 'incoming_order' && payload.action === 'closed') {
      const posterOrderId = String(payload.data?.incoming_order_id ?? '')
      if (!posterOrderId) return reply.send({ success: true })

      const order = await prisma.order.findFirst({
        where: { posterOrderId, locationId: location.id },
        include: { user: { select: { points: true } } },
      })

      if (order && order.status !== 'COMPLETED') {
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
      }
    }

    return reply.send({ success: true })
  })
}
