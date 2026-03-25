import { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import { prisma } from '../../lib/prisma'

export default async function posterWebhookRoutes(app: FastifyInstance) {

  // POST /webhooks/poster
  app.post('/', async (req, reply) => {
    // Verify webhook signature from Poster
    const signature = req.headers['x-poster-hook-signature'] as string
    const webhookSecret = process.env.POSTER_APP_SECRET

    if (webhookSecret && signature) {
      const body = JSON.stringify(req.body)
      const expected = crypto
        .createHmac('md5', webhookSecret)
        .update(body)
        .digest('hex')

      if (expected !== signature) {
        app.log.warn('Invalid Poster webhook signature')
        return reply.status(401).send({ error: 'Invalid signature' })
      }
    }

    const payload = req.body as any
    app.log.info({ posterWebhook: payload }, 'Received Poster webhook')

    // Handle order status changes
    if (payload.object === 'incoming_order' && payload.action === 'changed') {
      try {
        const posterOrderId = parseInt(payload.object_id)
        const posterStatus = payload.data?.status

        const order = await prisma.order.findFirst({
          where: { posterOrderId },
        })

        if (order) {
          // Map Poster status to our status
          // 1=new, 2=accepted, 3=ready, 4=delivered
          const statusMap: Record<number, string> = {
            1: 'PENDING',
            2: 'ACCEPTED',
            3: 'READY',
            4: 'COMPLETED',
          }

          const newStatus = statusMap[posterStatus]
          if (newStatus) {
            await prisma.order.update({
              where: { id: order.id },
              data: { status: newStatus as any },
            })
            app.log.info(`Order ${order.id} status updated to ${newStatus} via Poster webhook`)
          }
        }
      } catch (err) {
        app.log.error(err, 'Error processing Poster webhook')
      }
    }

    // Always return 200 so Poster doesn't retry
    return reply.status(200).send({ ok: true })
  })
}
