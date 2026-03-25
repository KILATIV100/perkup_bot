import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { verifyTelegramInitData } from '../lib/telegram'

const loginSchema = z.object({
  initData: z.string().min(1),
})

export default async function authRoutes(app: FastifyInstance) {

  // POST /api/auth/telegram
  app.post('/telegram', async (req, reply) => {
    const body = loginSchema.safeParse(req.body)
    if (!body.success) {
      return reply.status(400).send({ success: false, error: 'Invalid request' })
    }

    let telegramData
    try {
      telegramData = verifyTelegramInitData(body.data.initData)
    } catch (err: any) {
      return reply.status(401).send({ success: false, error: err.message })
    }

    const { user: tgUser, start_param } = telegramData

    // Check referral
    let referredById: number | undefined
    if (start_param?.startsWith('ref_')) {
      const refId = parseInt(start_param.replace('ref_', ''))
      if (!isNaN(refId)) {
        const refUser = await prisma.user.findUnique({ where: { id: refId } })
        if (refUser) referredById = refUser.id
      }
    }

    // Upsert user
    const user = await prisma.user.upsert({
      where: { telegramId: BigInt(tgUser.id) },
      update: {
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        username: tgUser.username || null,
        lastActivity: new Date(),
      },
      create: {
        telegramId: BigInt(tgUser.id),
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        username: tgUser.username || null,
        language: tgUser.language_code || 'uk',
        referredById: referredById || null,
      },
    })

    // Give referral bonus to new user (5 points)
    if (referredById && user.createdAt.getTime() > Date.now() - 5000) {
      await prisma.pointsTransaction.create({
        data: {
          userId: user.id,
          amount: 5,
          type: 'REFERRAL',
          description: 'Бонус за реєстрацію за реферальним посиланням',
          idempotencyKey: `referral-new-${user.id}`,
        },
      })
      await prisma.user.update({
        where: { id: user.id },
        data: { points: { increment: 5 } },
      })
    }

    // Generate JWT
    const token = app.jwt.sign({ id: user.id, role: user.role })

    return reply.send({
      success: true,
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
        points: user.points,
        level: user.level,
        language: user.language,
        onboardingDone: user.onboardingDone,
      },
    })
  })

  // GET /api/auth/me
  app.get('/me', {
    preHandler: async (req, reply) => {
      try { await req.jwtVerify() }
      catch { return reply.status(401).send({ success: false, error: 'Unauthorized' }) }
    },
  }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        telegramId: true,
        firstName: true,
        lastName: true,
        username: true,
        role: true,
        points: true,
        level: true,
        monthlyOrders: true,
        birthDate: true,
        language: true,
        preferredLocationId: true,
        onboardingDone: true,
        notifSpin: true,
        notifWinback: true,
        notifMorning: true,
        notifPromo: true,
        noShowCount: true,
        cashPaymentBlocked: true,
        createdAt: true,
      },
    })

    if (!user) {
      return reply.status(404).send({ success: false, error: 'User not found' })
    }

    return reply.send({
      success: true,
      user: {
        ...user,
        telegramId: user.telegramId.toString(),
      },
    })
  })

  // PATCH /api/auth/onboarding
  app.patch('/onboarding', {
    preHandler: async (req, reply) => {
      try { await req.jwtVerify() }
      catch { return reply.status(401).send({ success: false, error: 'Unauthorized' }) }
    },
  }, async (req, reply) => {
    const body = z.object({
      preferredLocationId: z.number().optional(),
      birthDate: z.string().optional(),
      language: z.enum(['uk', 'en']).optional(),
    }).safeParse(req.body)

    if (!body.success) {
      return reply.status(400).send({ success: false, error: 'Invalid data' })
    }

    const updateData: any = { onboardingDone: true }
    if (body.data.preferredLocationId) updateData.preferredLocationId = body.data.preferredLocationId
    if (body.data.language) updateData.language = body.data.language
    if (body.data.birthDate) {
      updateData.birthDate = new Date(body.data.birthDate)
      // Give 10 bonus points for filling birthday
      await prisma.pointsTransaction.upsert({
        where: { idempotencyKey: `birthday-fill-${req.user.id}` },
        update: {},
        create: {
          userId: req.user.id,
          amount: 10,
          type: 'BONUS',
          description: 'Бонус за заповнення дня народження',
          idempotencyKey: `birthday-fill-${req.user.id}`,
        },
      })
      await prisma.user.update({
        where: { id: req.user.id },
        data: { points: { increment: 10 } },
      })
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
    })

    return reply.send({ success: true })
  })
}
