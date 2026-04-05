import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireBarista } from '../plugins/auth'

const startSchema = z.object({
  locationId: z.number().int().positive(),
})

export default async function shiftsRoutes(app: FastifyInstance) {
  app.post('/start', { preHandler: await requireBarista }, async (req, reply) => {
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

  app.post('/end', { preHandler: await requireBarista }, async (req, reply) => {
    const active = await prisma.shift.findFirst({ where: { userId: req.user.id, endedAt: null } })
    if (!active) return reply.status(404).send({ success: false, error: 'No active shift' })

    const shift = await prisma.shift.update({
      where: { id: active.id },
      data: { endedAt: new Date() },
    })

    return reply.send({ success: true, shift })
  })

  app.get('/active', { preHandler: await requireBarista }, async (req, reply) => {
    const shift = await prisma.shift.findFirst({
      where: { userId: req.user.id, endedAt: null },
      include: { location: { select: { id: true, name: true, slug: true } } },
      orderBy: { startedAt: 'desc' },
    })

    return reply.send({ success: true, shift })
  })
}
