import { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { acquireLock, releaseLock } from '../lib/redis'
import { authenticate } from '../plugins/auth'

const spinSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
})

function kyivDateString(date = new Date()): string {
  const kyiv = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }))
  const y = kyiv.getFullYear()
  const m = String(kyiv.getMonth() + 1).padStart(2, '0')
  const d = String(kyiv.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function rollSpin(): number {
  const r = Math.random()
  if (r < 0.30) return 5
  if (r < 0.55) return 10
  if (r < 0.70) return 15
  return 0
}

export default async function loyaltyRoutes(app: FastifyInstance) {
  app.post('/spin', { preHandler: authenticate }, async (req, reply) => {
    const parsed = spinSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.flatten() })

    const today = kyivDateString()
    const lockKey = `spin:${req.user.id}:${today}`
    const lockOk = await acquireLock(lockKey, 10)
    if (!lockOk) return reply.status(409).send({ success: false, error: 'Spin already in progress' })

    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } })
      if (!user) return reply.status(404).send({ success: false, error: 'User not found' })
      if (user.lastSpinDate === today) {
        return reply.status(400).send({ success: false, error: 'Daily spin already used', nextSpinDate: today })
      }

      const reward = rollSpin()
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: req.user.id },
          data: {
            lastSpinDate: today,
            points: reward > 0 ? { increment: reward } : undefined,
            lastActivity: new Date(),
          },
          select: { id: true, points: true, lastSpinDate: true },
        })

        await tx.pointsTransaction.create({
          data: {
            userId: req.user.id,
            amount: reward,
            type: 'SPIN',
            description: reward > 0 ? `Щоденний спін: +${reward}` : 'Щоденний спін: без виграшу',
            idempotencyKey: `spin-${req.user.id}-${today}`,
          },
        })

        return u
      })

      return reply.send({
        success: true,
        reward,
        message: reward > 0 ? `Вітаємо! +${reward} балів` : 'Спробуй завтра ✨',
        user: updated,
      })
    } finally {
      await releaseLock(lockKey)
    }
  })

  app.get('/transactions', { preHandler: authenticate }, async (req, reply) => {
    const transactions = await prisma.pointsTransaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return reply.send({ success: true, transactions })
  })

  app.get('/referral', { preHandler: authenticate }, async (req, reply) => {
    const botUsername = process.env.BOT_USERNAME || 'perkup_bot'
    const link = `https://t.me/${botUsername}?start=ref_${req.user.id}`

    const invited = await prisma.user.count({ where: { referredById: req.user.id } })

    return reply.send({
      success: true,
      referral: {
        link,
        invited,
      },
    })
  })

  app.post('/redeem', { preHandler: authenticate }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return reply.status(404).send({ success: false, error: 'User not found' })
    if (user.points < 100) return reply.status(400).send({ success: false, error: 'Not enough points (need 100)' })

    const code = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const redemption = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: req.user.id }, data: { points: { decrement: 100 } } })
      await tx.pointsTransaction.create({
        data: {
          userId: req.user.id,
          amount: -100,
          type: 'REDEEM',
          description: 'Обмін 100 балів на напій',
          idempotencyKey: `redeem-${req.user.id}-${Date.now()}`,
        },
      })

      return tx.redemptionCode.create({
        data: { userId: req.user.id, code, points: 100, expiresAt },
      })
    })

    return reply.send({ success: true, redemption })
  })
}
