import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireBarista } from '../plugins/auth'

const startSchema = z.object({
  locationId: z.number().int().positive(),
})

export default async function shiftsRoutes(app: FastifyInstance) {
  app.post('/start', { preHandler: requireBarista }, async (req, reply) => {
    const parsed = startSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.flatten() })

    const active = await prisma.shift.findFirst({ where: { userId: req.user.id, endedAt: null } })
    if (active) return reply.status(400).send({ success: false, error: 'Shift already active', shift: active })

    const location = await prisma.location.findUnique({ where: { id: parsed.data.locationId } })
    if (!location || !location.isActive) return reply.status(404).send({ success: false, error: 'Location not found' })

    const shift = await prisma.shift.create({
      data: {
        userId: req.user.id,
        locationId: parsed.data.locationId,
      },
    })

    return reply.status(201).send({ success: true, shift })
  })

  app.post('/end', { preHandler: requireBarista }, async (req, reply) => {
    const active = await prisma.shift.findFirst({ where: { userId: req.user.id, endedAt: null } })
    if (!active) return reply.status(404).send({ success: false, error: 'No active shift' })

    const shift = await prisma.shift.update({
      where: { id: active.id },
      data: { endedAt: new Date() },
    })

    return reply.send({ success: true, shift })
  })

  app.get('/active', { preHandler: requireBarista }, async (req, reply) => {
    const shift = await prisma.shift.findFirst({
      where: { userId: req.user.id, endedAt: null },
      include: { location: { select: { id: true, name: true, slug: true } } },
      orderBy: { startedAt: 'desc' },
    })

    return reply.send({ success: true, shift })
  })

  app.get('/history', { preHandler: requireBarista }, async (req, reply) => {
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      locationId: z.coerce.number().int().positive().optional(),
    }).safeParse(req.query)

    const page = query.success ? query.data.page : 1
    const take = 20
    const skip = (page - 1) * take
    const where: any = { userId: req.user.id, endedAt: { not: null } }
    if (query.success && query.data.locationId) where.locationId = query.data.locationId

    const [shifts, total] = await Promise.all([
      prisma.shift.findMany({
        where,
        include: { location: { select: { id: true, name: true, slug: true } } },
        orderBy: { startedAt: 'desc' },
        take,
        skip,
      }),
      prisma.shift.count({ where }),
    ])

    return reply.send({
      success: true,
      shifts,
      total,
      pages: Math.ceil(total / take),
    })
  })

  app.get('/analytics', { preHandler: requireBarista }, async (req, reply) => {
    const query = z.object({
      days: z.coerce.number().int().min(1).max(90).default(30),
    }).safeParse(req.query)
    const days = query.success ? query.data.days : 30
    const since = new Date(Date.now() - days * 86400000)
    const where = { userId: req.user.id, startedAt: { gte: since } }
    const shifts = await prisma.shift.findMany({ where, select: { id: true } })
    const shiftIds = shifts.map((s) => s.id)

    if (shiftIds.length === 0) {
      return reply.send({
        success: true,
        analytics: {
          periodDays: days,
          shiftsCount: 0,
          completedOrders: 0,
          revenue: 0,
          avgRating: 0,
          reviewsCount: 0,
          tipsTotal: 0,
        },
      })
    }

    const [ordersAgg, reviewAgg, tipsAgg] = await Promise.all([
      prisma.order.aggregate({
        where: { shiftId: { in: shiftIds }, status: 'COMPLETED', createdAt: { gte: since } },
        _count: { id: true },
        _sum: { total: true },
      }),
      prisma.review.aggregate({
        where: { shiftId: { in: shiftIds }, createdAt: { gte: since } },
        _avg: { rating: true },
        _count: true,
      }),
      prisma.tip.aggregate({
        where: { shiftId: { in: shiftIds }, createdAt: { gte: since } },
        _sum: { amount: true },
      }),
    ])

    return reply.send({
      success: true,
      analytics: {
        periodDays: days,
        shiftsCount: shifts.length,
        completedOrders: ordersAgg._count.id || 0,
        revenue: Number(ordersAgg._sum.total || 0),
        avgRating: Number(reviewAgg._avg.rating || 0),
        reviewsCount: reviewAgg._count || 0,
        tipsTotal: Number(tipsAgg._sum.amount || 0),
      },
    })
  })
}
