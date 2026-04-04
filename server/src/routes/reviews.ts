import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../plugins/auth'

const createReviewSchema = z.object({
  orderId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  text: z.string().max(1000).optional(),
})

export default async function reviewRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: authenticate }, async (req, reply) => {
    const parsed = createReviewSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.flatten() })

    const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } })
    if (!order || order.userId !== req.user.id) {
      return reply.status(404).send({ success: false, error: 'Order not found' })
    }
    if (order.status !== 'COMPLETED') {
      return reply.status(400).send({ success: false, error: 'Review available only for completed orders' })
    }

    const existing = await prisma.review.findUnique({ where: { orderId: order.id } })
    if (existing) return reply.status(409).send({ success: false, error: 'Review already exists' })

    const review = await prisma.review.create({
      data: {
        orderId: order.id,
        userId: req.user.id,
        locationId: order.locationId,
        shiftId: order.shiftId,
        rating: parsed.data.rating,
        text: parsed.data.text,
        isPublic: parsed.data.rating >= 4,
      },
    })

    const location = await prisma.location.findUnique({
      where: { id: order.locationId },
      select: { googlePlaceId: true, name: true },
    })

    const googleReviewUrl = parsed.data.rating >= 4 && location?.googlePlaceId
      ? `https://search.google.com/local/writereview?placeid=${location.googlePlaceId}`
      : null

    return reply.status(201).send({
      success: true,
      review,
      next: googleReviewUrl
        ? { type: 'GOOGLE_REVIEW', url: googleReviewUrl, location: location?.name }
        : { type: 'PRIVATE_FEEDBACK' },
    })
  })

  app.get('/my', { preHandler: authenticate }, async (req, reply) => {
    const reviews = await prisma.review.findMany({
      where: { userId: req.user.id },
      include: {
        order: { select: { id: true, total: true, createdAt: true } },
        location: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    return reply.send({ success: true, reviews })
  })
}
