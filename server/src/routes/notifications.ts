import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../plugins/auth'

const updateSchema = z.object({
  notifSpin: z.boolean().optional(),
  notifWinback: z.boolean().optional(),
  notifMorning: z.boolean().optional(),
  notifPromo: z.boolean().optional(),
})

export default async function notificationsRoutes(app: FastifyInstance) {
  app.get('/settings', { preHandler: authenticate }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        notifSpin: true,
        notifWinback: true,
        notifMorning: true,
        notifPromo: true,
      },
    })

    if (!user) return reply.status(404).send({ success: false, error: 'User not found' })
    return reply.send({ success: true, notifications: user })
  })

  app.patch('/settings', { preHandler: authenticate }, async (req, reply) => {
    const parsed = updateSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.flatten() })

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: parsed.data,
      select: {
        notifSpin: true,
        notifWinback: true,
        notifMorning: true,
        notifPromo: true,
      },
    })

    return reply.send({ success: true, notifications: updated })
  })
}
