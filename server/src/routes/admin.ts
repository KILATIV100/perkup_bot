import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { syncAllLocations, syncPosterMenu } from '../services/poster'

export default async function adminRoutes(app: FastifyInstance) {

  // ─── Auth guard: ADMIN or OWNER ──────────────────────────────
  const adminOnly = async (req: any, reply: any) => {
    try { await req.jwtVerify() } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }
    if (!['ADMIN', 'OWNER'].includes(req.user.role)) {
      return reply.status(403).send({ success: false, error: 'Admin only' })
    }
  }

  // ─── DASHBOARD ────────────────────────────────────────────────
  app.get('/dashboard', { preHandler: adminOnly }, async (_req: any, reply: any) => {
    const [usersCount, ordersToday, ordersTotal, revenue, locationsCount] = await Promise.all([
      prisma.user.count(),
      prisma.order.count({
        where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) }, status: { not: 'CANCELLED' } },
      }),
      prisma.order.count({ where: { status: 'COMPLETED' } }),
      prisma.order.aggregate({ where: { status: 'COMPLETED' }, _sum: { total: true } }),
      prisma.location.count({ where: { isActive: true } }),
    ])

    return reply.send({
      success: true,
      stats: {
        usersCount,
        ordersToday,
        ordersTotal,
        revenue: Number(revenue._sum.total || 0),
        locationsCount,
      },
    })
  })

  // ─── USERS ────────────────────────────────────────────────────
  app.get('/users', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      role: z.string().optional(),
      search: z.string().optional(),
    }).safeParse(req.query)
    const page = query.success ? query.data.page : 1
    const take = 20
    const skip = (page - 1) * take

    const where: any = {}
    if (query.success && query.data.role) where.role = query.data.role
    if (query.success && query.data.search) {
      where.OR = [
        { firstName: { contains: query.data.search, mode: 'insensitive' } },
        { username: { contains: query.data.search, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, telegramId: true, firstName: true, lastName: true, username: true, role: true, points: true, level: true, monthlyOrders: true, onboardingDone: true, lastActivity: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.user.count({ where }),
    ])

    return reply.send({
      success: true,
      users: users.map(u => ({ ...u, telegramId: u.telegramId.toString() })),
      total,
      pages: Math.ceil(total / take),
    })
  })

  app.patch('/users/:id/role', { preHandler: adminOnly }, async (req: any, reply: any) => {
    // Only OWNER can change roles
    if (req.user.role !== 'OWNER') {
      return reply.status(403).send({ success: false, error: 'Only owner can change roles' })
    }
    const id = Number(req.params.id)
    const body = z.object({ role: z.enum(['USER', 'BARISTA', 'ADMIN', 'OWNER']) }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid role' })

    const user = await prisma.user.update({
      where: { id },
      data: { role: body.data.role },
      select: { id: true, firstName: true, role: true },
    })
    return reply.send({ success: true, user })
  })

  // ─── ORDERS ───────────────────────────────────────────────────
  app.get('/orders', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const query = z.object({
      page: z.coerce.number().int().min(1).default(1),
      status: z.string().optional(),
      locationId: z.coerce.number().optional(),
    }).safeParse(req.query)
    const page = query.success ? query.data.page : 1
    const take = 20
    const skip = (page - 1) * take

    const where: any = {}
    if (query.success && query.data.status) where.status = query.data.status
    if (query.success && query.data.locationId) where.locationId = query.data.locationId

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: { select: { firstName: true, username: true } },
          location: { select: { name: true, slug: true } },
          items: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.order.count({ where }),
    ])

    return reply.send({ success: true, orders, total, pages: Math.ceil(total / take) })
  })

  // ─── LOCATIONS ────────────────────────────────────────────────
  app.get('/locations', { preHandler: adminOnly }, async (_req: any, reply: any) => {
    const locations = await prisma.location.findMany({
      include: { workingHours: true, _count: { select: { products: true, orders: true } } },
      orderBy: { id: 'asc' },
    })
    return reply.send({ success: true, locations })
  })

  app.patch('/locations/:id', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const id = Number(req.params.id)
    const body = z.object({
      allowOrders: z.boolean().optional(),
      busyMode: z.boolean().optional(),
      maxQueueSize: z.number().int().min(1).max(100).optional(),
      isActive: z.boolean().optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid data' })

    const location = await prisma.location.update({ where: { id }, data: body.data })
    return reply.send({ success: true, location })
  })

  // ─── MENU: Categories & Products sorting ──────────────────────
  app.get('/menu/:locationSlug', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const slug = req.params.locationSlug
    const location = await prisma.location.findUnique({ where: { slug } })
    if (!location) return reply.status(404).send({ success: false, error: 'Location not found' })

    const products = await prisma.product.findMany({
      where: { locationId: location.id },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    // Build category list with order
    const catMap = new Map<string, { sortOrder: number; count: number }>()
    for (const p of products) {
      const existing = catMap.get(p.category)
      if (!existing) {
        catMap.set(p.category, { sortOrder: p.sortOrder, count: 1 })
      } else {
        existing.count++
      }
    }
    const categories = Array.from(catMap.entries())
      .map(([name, data]) => ({ name, sortOrder: data.sortOrder, count: data.count }))
      .sort((a, b) => a.sortOrder - b.sortOrder)

    return reply.send({ success: true, locationId: location.id, categories, products })
  })

  // Reorder categories
  app.post('/menu/:locationSlug/reorder-categories', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const slug = req.params.locationSlug
    const body = z.object({
      categories: z.array(z.string()).min(1),
    }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid data' })

    const location = await prisma.location.findUnique({ where: { slug } })
    if (!location) return reply.status(404).send({ success: false, error: 'Location not found' })

    // Set sortOrder for each product based on category position
    const cats = body.data.categories
    for (let i = 0; i < cats.length; i++) {
      await prisma.product.updateMany({
        where: { locationId: location.id, category: cats[i] },
        data: { sortOrder: (i + 1) * 100 },
      })
    }

    // Clear menu cache
    await redis.del('menu:' + slug)

    return reply.send({ success: true })
  })

  // Reorder products within a category
  app.post('/menu/:locationSlug/reorder-products', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const slug = req.params.locationSlug
    const body = z.object({
      productIds: z.array(z.number().int().positive()).min(1),
    }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid data' })

    const location = await prisma.location.findUnique({ where: { slug } })
    if (!location) return reply.status(404).send({ success: false, error: 'Location not found' })

    // Update sortOrder for each product
    for (let i = 0; i < body.data.productIds.length; i++) {
      await prisma.product.updateMany({
        where: { id: body.data.productIds[i], locationId: location.id },
        data: { sortOrder: i + 1 },
      })
    }

    await redis.del('menu:' + slug)
    return reply.send({ success: true })
  })

  // Toggle product availability
  app.patch('/products/:id', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const id = Number(req.params.id)
    const body = z.object({
      isAvailable: z.boolean().optional(),
      price: z.number().positive().optional(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(500).optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid data' })

    const product = await prisma.product.update({ where: { id }, data: body.data })

    // Clear cache for this location
    const loc = await prisma.location.findUnique({ where: { id: product.locationId } })
    if (loc) await redis.del('menu:' + loc.slug)

    return reply.send({ success: true, product })
  })

  // ─── SYNC (existing) ─────────────────────────────────────────
  app.post('/sync', { preHandler: adminOnly }, async (_req: any, reply: any) => {
    syncAllLocations().catch(e => console.error('[Admin sync error]', e))
    return reply.send({ success: true, message: 'Sync started' })
  })

  app.post('/sync/:slug', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const slug = (req.params as any).slug
    try {
      const result = await syncPosterMenu(slug)
      return reply.send({ success: true, ...result })
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  // ─── DB helpers (existing, now protected) ─────────────────────
  app.post('/db-push', { preHandler: adminOnly }, async (_req: any, reply: any) => {
    const results: string[] = []
    const run = async (sql: string, label: string) => {
      try {
        await prisma.$executeRawUnsafe(sql)
        results.push('OK: ' + label)
      } catch (e: any) {
        results.push('SKIP: ' + label + ' (' + e.message.split('\n')[0] + ')')
      }
    }
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "hasPoster" BOOLEAN NOT NULL DEFAULT false', 'Location.hasPoster')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "posterSubdomain" TEXT', 'Location.posterSubdomain')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "posterAccount" TEXT', 'Location.posterAccount')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "posterToken" TEXT', 'Location.posterToken')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "posterSpotId" INTEGER', 'Location.posterSpotId')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "googlePlaceId" TEXT', 'Location.googlePlaceId')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "googleMapsUrl" TEXT', 'Location.googleMapsUrl')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "busyMode" BOOLEAN NOT NULL DEFAULT false', 'Location.busyMode')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "busyModeUntil" TIMESTAMP', 'Location.busyModeUntil')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "maxQueueSize" INTEGER NOT NULL DEFAULT 10', 'Location.maxQueueSize')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "hasPrinter" BOOLEAN NOT NULL DEFAULT false', 'Location.hasPrinter')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "printerIp" TEXT', 'Location.printerIp')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP', 'User.birthDate')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastBirthdayBonus" INTEGER', 'User.lastBirthdayBonus')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredById" INTEGER', 'User.referredById')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralBonusPaid" BOOLEAN NOT NULL DEFAULT false', 'User.referralBonusPaid')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredLocationId" INTEGER', 'User.preferredLocationId')
    await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'uk'`, 'User.language')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "noShowCount" INTEGER NOT NULL DEFAULT 0', 'User.noShowCount')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cashPaymentBlocked" BOOLEAN NOT NULL DEFAULT false', 'User.cashPaymentBlocked')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifSpin" BOOLEAN NOT NULL DEFAULT true', 'User.notifSpin')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifWinback" BOOLEAN NOT NULL DEFAULT true', 'User.notifWinback')
    await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "radioGenre" TEXT DEFAULT 'all'`, 'User.radioGenre')
    await run(`CREATE TABLE IF NOT EXISTS "SpinResult" ("id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL, "prizeId" TEXT NOT NULL, "prizeLabel" TEXT NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW())`, 'SpinResult')
    await run('CREATE INDEX IF NOT EXISTS "SpinResult_userId_idx" ON "SpinResult"("userId")', 'SpinResult index')
    await run(`CREATE TABLE IF NOT EXISTS "PrizeVoucher" ("id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL, "code" TEXT NOT NULL UNIQUE, "prizeId" TEXT NOT NULL, "prizeLabel" TEXT NOT NULL, "prizeType" TEXT NOT NULL, "prizeValue" INTEGER NOT NULL DEFAULT 0, "isUsed" BOOLEAN NOT NULL DEFAULT FALSE, "usedAt" TIMESTAMP, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW())`, 'PrizeVoucher')
    await run('CREATE INDEX IF NOT EXISTS "PrizeVoucher_userId_idx" ON "PrizeVoucher"("userId")', 'PrizeVoucher index')
    await run(`CREATE TABLE IF NOT EXISTS "RadioTrack" ("id" SERIAL PRIMARY KEY, "fileId" TEXT NOT NULL, "title" TEXT NOT NULL, "artist" TEXT NOT NULL DEFAULT 'PerkUp Radio', "duration" INTEGER NOT NULL DEFAULT 180, "genre" TEXT NOT NULL DEFAULT 'lofi', "url" TEXT NOT NULL, "position" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW())`, 'RadioTrack')
    await run(`CREATE TABLE IF NOT EXISTS "Shift" ("id" SERIAL PRIMARY KEY, "locationId" INTEGER NOT NULL, "userId" INTEGER NOT NULL, "startedAt" TIMESTAMP NOT NULL DEFAULT NOW(), "endedAt" TIMESTAMP, "cashStart" DECIMAL(10,2) NOT NULL DEFAULT 0, "cashEnd" DECIMAL(10,2), "ordersCount" INTEGER NOT NULL DEFAULT 0, "revenue" DECIMAL(10,2) NOT NULL DEFAULT 0, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW())`, 'Shift')
    await run(`CREATE TABLE IF NOT EXISTS "Review" ("id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL, "orderId" INTEGER, "locationId" INTEGER NOT NULL, "rating" INTEGER NOT NULL, "comment" TEXT, "isPublic" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW())`, 'Review')
    await run(`CREATE TABLE IF NOT EXISTS "Tip" ("id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL, "orderId" INTEGER NOT NULL, "amount" DECIMAL(10,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW())`, 'Tip')
    await run(`CREATE TABLE IF NOT EXISTS "GameSession" ("id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL, "gameType" TEXT NOT NULL, "score" INTEGER NOT NULL DEFAULT 0, "duration" INTEGER, "reward" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW())`, 'GameSession')
    await run(`CREATE TABLE IF NOT EXISTS "RedemptionCode" ("id" SERIAL PRIMARY KEY, "code" TEXT NOT NULL UNIQUE, "type" TEXT NOT NULL, "value" INTEGER NOT NULL DEFAULT 0, "isUsed" BOOLEAN NOT NULL DEFAULT false, "usedById" INTEGER, "usedAt" TIMESTAMP, "expiresAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW())`, 'RedemptionCode')
    await run(`CREATE TABLE IF NOT EXISTS "Promo" ("id" SERIAL PRIMARY KEY, "code" TEXT NOT NULL UNIQUE, "type" TEXT NOT NULL, "value" INTEGER NOT NULL DEFAULT 0, "maxUses" INTEGER, "usedCount" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true, "startsAt" TIMESTAMP, "endsAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW())`, 'Promo')
    return reply.send({ success: true, results })
  })

  app.get('/db-check', { preHandler: adminOnly }, async (_req: any, reply: any) => {
    const krona = await prisma.location.findUnique({ where: { slug: 'krona' } })
    const pryozerny = await prisma.location.findUnique({ where: { slug: 'pryozerny' } })
    const kronaCount = krona ? await prisma.product.count({ where: { locationId: krona.id } }) : 0
    const pryCount = pryozerny ? await prisma.product.count({ where: { locationId: pryozerny.id } }) : 0
    let spinCount = 0, voucherCount = 0
    try {
      const s = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM "SpinResult"` as any[]
      spinCount = Number(s[0]?.cnt || 0)
      const v = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM "PrizeVoucher"` as any[]
      voucherCount = Number(v[0]?.cnt || 0)
    } catch (_e) {}
    return reply.send({ success: true, kronaCount, pryCount, spinCount, voucherCount })
  })
}
