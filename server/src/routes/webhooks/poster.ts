import { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import { prisma } from '../../lib/prisma'

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
      })

      if (order && order.status !== 'COMPLETED') {
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: { status: 'COMPLETED' },
          })

          const pointsEarned = Math.floor(Number(order.total) / 10)
          if (pointsEarned > 0) {
            await tx.user.update({
              where: { id: order.userId },
              data: { points: { increment: pointsEarned } },
            })
            await tx.pointsTransaction.upsert({
              where: { idempotencyKey: `order-completed-points-${order.id}` },
              update: {},
              create: {
                userId: order.userId,
                amount: pointsEarned,
                type: 'ORDER',
                description: `Бали за замовлення #${order.id}`,
                idempotencyKey: `order-completed-points-${order.id}`,
              },
            })
          }
        })
      }
    }

    return reply.send({ success: true })
  })
}
