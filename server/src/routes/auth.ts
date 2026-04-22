import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { verifyTelegramInitData, verifyTelegramLoginWidget } from '../lib/telegram'
import { normalizePhone } from '../lib/phone'

const loginSchema = z.object({
  initData: z.string().min(1),
})

export default async function authRoutes(app: FastifyInstance) {

  // DEV helper login for local/staging smoke tests outside Telegram WebApp.
  // Enabled only when explicitly allowed.
  app.post('/dev-login', async (req, reply) => {
    if (process.env.ALLOW_DEV_LOGIN !== 'true') {
      return reply.status(403).send({ success: false, error: 'Dev login disabled' })
    }

    const body = z.object({
      telegramId: z.coerce.number().int().positive().optional(),
      firstName: z.string().min(1).max(100).optional(),
    }).safeParse(req.body)

    if (!body.success) {
      return reply.status(400).send({ success: false, error: 'Invalid request' })
    }

    const user: any = await prisma.user.upsert({
      where: { telegramId: BigInt(body.data.telegramId || 999000001) },
      update: { lastActivity: new Date() },
      create: {
        telegramId: BigInt(body.data.telegramId || 999000001),
        firstName: body.data.firstName || 'Dev User',
        language: 'uk',
        onboardingDone: true,
      },
    })

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
        phone: user.phone,
        language: user.language,
        onboardingDone: user.onboardingDone,
      },
    })
  })

  // POST /api/auth/widget-login — Telegram Login Widget (browser auth)
  app.post('/widget-login', async (req, reply) => {
    const body = z.object({
      id: z.coerce.string(),
      first_name: z.string(),
      last_name: z.string().optional(),
      username: z.string().optional(),
      photo_url: z.string().optional(),
      auth_date: z.coerce.string(),
      hash: z.string(),
    }).safeParse(req.body)

    if (!body.success) {
      return reply.status(400).send({ success: false, error: 'Invalid request' })
    }

    let tgUser
    try {
      // Build the data object for verification (all string values)
      const dataForVerify: Record<string, string> = {
        id: body.data.id,
        first_name: body.data.first_name,
        auth_date: body.data.auth_date,
        hash: body.data.hash,
      }
      if (body.data.last_name) dataForVerify.last_name = body.data.last_name
      if (body.data.username) dataForVerify.username = body.data.username
      if (body.data.photo_url) dataForVerify.photo_url = body.data.photo_url

      tgUser = verifyTelegramLoginWidget(dataForVerify)
    } catch (err: any) {
      return reply.status(401).send({ success: false, error: err.message })
    }

    const user: any = await prisma.user.upsert({
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
        language: 'uk',
      },
    })

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
        phone: user.phone,
        language: user.language,
        onboardingDone: user.onboardingDone,
      },
    })
  })

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
    const user: any = await prisma.user.upsert({
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
        phone: user.phone,
        language: user.language,
        onboardingDone: user.onboardingDone,
      },
    })
  })

  // GET /api/auth/bot/:telegramId — для Telegram бота (захищений BOT_SECRET)
  app.get('/bot/:telegramId', async (req: any, reply: any) => {
    const secret = req.headers['x-bot-secret']
    if (!secret || secret !== process.env.BOT_SECRET) {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }
    const telegramId = BigInt(req.params.telegramId)
    const user = await prisma.user.findUnique({
      where: { telegramId },
    })
    if (!user) return reply.status(404).send({ success: false, error: 'Not found' })

    const completedOrders = await prisma.order.count({
      where: { userId: user.id, status: 'COMPLETED' },
    })
    const boughtSpinCredits = Math.floor((user.monthlyOrders || 0) / 5)
    const spinsEarned = Math.floor(completedOrders / 5) + boughtSpinCredits
    const spinsUsed = await prisma.spinResult.count({ where: { userId: user.id } })
    const spinsAvailable = Math.max(0, spinsEarned - spinsUsed)

    const points = user.points
    const level = points >= 3000 ? 'Platinum' : points >= 1000 ? 'Gold' : points >= 300 ? 'Silver' : 'Bronze'
    const levelMap: Record<string, { name: string; required: number } | null> = {
      Bronze:   { name: 'Silver', required: 300 },
      Silver:   { name: 'Gold', required: 1000 },
      Gold:     { name: 'Platinum', required: 3000 },
      Platinum: null,
    }

    return reply.send({
      success: true,
      points,
      level,
      nextLevel: levelMap[level],
      completedOrders,
      spinsAvailable,
      firstName: user.firstName,
    })
  })

  // GET /api/auth/me
  app.get('/me', {
    preHandler: async (req, reply) => {
      try { await req.jwtVerify() }
      catch { return reply.status(401).send({ success: false, error: 'Unauthorized' }) }
    },
  }, async (req, reply) => {
    const user: any = await prisma.user.findUnique({
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
        phone: true,
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
      phone: z.string().optional(),
      language: z.enum(['uk', 'en']).optional(),
    }).safeParse(req.body)

    if (!body.success) {
      return reply.status(400).send({ success: false, error: 'Invalid data' })
    }

    const updateData: any = { onboardingDone: true }
    if (body.data.preferredLocationId) updateData.preferredLocationId = body.data.preferredLocationId
    if (body.data.language) updateData.language = body.data.language
    if (body.data.phone) {
      try {
        updateData.phone = normalizePhone(body.data.phone)
      } catch (error) {
        return reply.status(400).send({ success: false, error: (error as Error).message })
      }
    }
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

  // PATCH /api/auth/settings — update language, notifications, etc.
  app.patch('/settings', {
    preHandler: async (req, reply) => {
      try { await req.jwtVerify() }
      catch { return reply.status(401).send({ success: false, error: 'Unauthorized' }) }
    },
  }, async (req, reply) => {
    const body = z.object({
      language: z.enum(['uk', 'en']).optional(),
      phone: z.string().optional(),
      notifSpin: z.boolean().optional(),
      notifWinback: z.boolean().optional(),
      notifMorning: z.boolean().optional(),
      notifPromo: z.boolean().optional(),
    }).safeParse(req.body)

    if (!body.success) {
      return reply.status(400).send({ success: false, error: 'Invalid data' })
    }

    const data: any = {}
    if (body.data.language !== undefined) data.language = body.data.language
    if (body.data.phone !== undefined) {
      try {
        data.phone = body.data.phone ? normalizePhone(body.data.phone) : null
      } catch (error) {
        return reply.status(400).send({ success: false, error: (error as Error).message })
      }
    }
    if (body.data.notifSpin !== undefined) data.notifSpin = body.data.notifSpin
    if (body.data.notifWinback !== undefined) data.notifWinback = body.data.notifWinback
    if (body.data.notifMorning !== undefined) data.notifMorning = body.data.notifMorning
    if (body.data.notifPromo !== undefined) data.notifPromo = body.data.notifPromo

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ success: false, error: 'No fields to update' })
    }

    const user: any = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        phone: true,
        language: true,
        notifSpin: true,
        notifWinback: true,
        notifMorning: true,
        notifPromo: true,
      },
    })

    return reply.send({ success: true, settings: user })
  })

  // ─── TEST MODE (OWNER only) ──────────────────────────────────
  const ownerOnly = async (req: any, reply: any) => {
    try { await req.jwtVerify() }
    catch { return reply.status(401).send({ success: false, error: 'Unauthorized' }) }
    if (req.user.role !== 'OWNER' && req.user.role !== 'ADMIN') {
      return reply.status(403).send({ success: false, error: 'Owner only' })
    }
  }

  // POST /api/auth/test-reset — full reset to go through onboarding again
  app.post('/test-reset', { preHandler: ownerOnly }, async (req: any, reply) => {
    const userId = req.user.id

    // Delete related records (order items first, then orders)
    const orders = await prisma.order.findMany({ where: { userId }, select: { id: true } })
    const orderIds = orders.map(o => o.id)

    if (orderIds.length > 0) {
      await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })
      await prisma.review.deleteMany({ where: { orderId: { in: orderIds } } })
      await prisma.tip.deleteMany({ where: { orderId: { in: orderIds } } })
      await prisma.order.deleteMany({ where: { userId } })
    }

    await prisma.pointsTransaction.deleteMany({ where: { userId } })
    await prisma.redemptionCode.deleteMany({ where: { userId } })

    await prisma.spinResult.deleteMany({ where: { userId } })
    await prisma.prizeVoucher.deleteMany({ where: { userId } })

    // Clear Redis game stats
    try {
      await redis.zrem('coffee-jump:leaderboard', String(userId))
      await redis.del(`coffee-jump:daily:${userId}:${new Date().toISOString().slice(0, 10)}`)
      await redis.del(`coffee-jump:best:${userId}`)
    } catch {}

    // Reset user fields
    const user: any = await prisma.user.update({
      where: { id: userId },
      data: {
        points: 0,
        level: 'BRONZE',
        monthlyOrders: 0,
        onboardingDone: false,
        lastSpinDate: null,
        preferredLocationId: null,
        birthDate: null,
        lastBirthdayBonus: null,
        noShowCount: 0,
        cashPaymentBlocked: false,
      },
    })

    // Re-sign JWT with same data
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
        phone: user.phone,
        language: user.language,
        onboardingDone: user.onboardingDone,
      },
    })
  })

  // POST /api/auth/test-add-orders — simulate N completed orders for spin testing
  app.post('/test-add-orders', { preHandler: ownerOnly }, async (req: any, reply) => {
    const body = z.object({ count: z.number().int().min(1).max(50).default(5), locationSlug: z.string().optional() }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid data' })

    const userId = req.user.id
    const count = body.data.count

    // Find a location
    const location = body.data.locationSlug
      ? await prisma.location.findUnique({ where: { slug: body.data.locationSlug } })
      : await prisma.location.findFirst()
    if (!location) return reply.status(400).send({ success: false, error: 'No location found' })

    // Create fake completed orders
    for (let i = 0; i < count; i++) {
      const order = await prisma.order.create({
        data: {
          userId,
          locationId: location.id,
          status: 'COMPLETED',
          total: 120,
          paymentMethod: 'card',
          comment: `[TEST] Тестове замовлення #${i + 1}`,
        },
      })
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          name: 'Тестовий капучіно',
          price: 120,
          quantity: 1,
        },
      })
    }

    // Give order points (10 pts per order)
    const pointsPerOrder = 10
    const totalPoints = count * pointsPerOrder
    await prisma.pointsTransaction.create({
      data: {
        userId,
        amount: totalPoints,
        type: 'ORDER',
        description: `[TEST] Бонус за ${count} тестових замовлень`,
        idempotencyKey: `test-orders-${userId}-${Date.now()}`,
      },
    })

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        points: { increment: totalPoints },
        monthlyOrders: { increment: count },
      },
    })

    // Recalculate level
    const level = user.points >= 3000 ? 'Platinum' : user.points >= 1000 ? 'Gold' : user.points >= 300 ? 'Silver' : 'BRONZE'
    if (level !== user.level) {
      await prisma.user.update({ where: { id: userId }, data: { level } })
    }

    return reply.send({
      success: true,
      ordersCreated: count,
      pointsAdded: totalPoints,
      totalPoints: user.points,
      totalOrders: user.monthlyOrders,
    })
  })

  // POST /api/auth/test-set-points — set exact points value for testing levels/spins
  app.post('/test-set-points', { preHandler: ownerOnly }, async (req: any, reply) => {
    const body = z.object({ points: z.number().int().min(0).max(100000) }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid data' })

    const userId = req.user.id
    const pts = body.data.points
    const level = pts >= 3000 ? 'Platinum' : pts >= 1000 ? 'Gold' : pts >= 300 ? 'Silver' : 'BRONZE'

    const user = await prisma.user.update({
      where: { id: userId },
      data: { points: pts, level },
    })

    return reply.send({ success: true, points: user.points, level: user.level })
  })
}
