import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { getLocationProfile } from '../lib/locationProfile'
import {
  getCategoryOrder,
  getNextCategoryOrder,
  getNextProductSortOrder,
  mergeStoredCategories,
  parseStoredCategories,
  sortMenuProducts,
  type StoredMenuCategory,
} from '../lib/menuPresentation'
import { syncAllLocations, syncPosterMenu } from '../services/poster'

function makeCategoryOrder(categories: string[]): StoredMenuCategory[] {
  return categories.map((name, index) => ({ name, sortOrder: (index + 1) * 100 }))
}

function uniqueCategoryNames(categories: string[]): string[] {
  return Array.from(new Set(categories.map((item) => item.trim()).filter(Boolean)))
}

function getNormalizedCategory(name: string): string {
  return name.trim()
}

function requireManualMenu(location: { slug: string; hasPoster?: boolean; allowOrders: boolean }) {
  const profile = getLocationProfile(location)
  if (profile.menuManagement !== 'LOCAL') {
    throw new Error('Full menu editing is available only for local self-service menus')
  }
}

async function clearLocationMenuCache(locationSlug: string) {
  await redis.del('menu:' + locationSlug)
}

export default async function adminRoutes(app: FastifyInstance) {
  const adminOnly = async (req: any, reply: any) => {
    try {
      await req.jwtVerify()
    } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }

    if (!['ADMIN', 'OWNER'].includes(req.user.role)) {
      return reply.status(403).send({ success: false, error: 'Admin only' })
    }
  }

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
          onboardingDone: true,
          lastActivity: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.user.count({ where }),
    ])

    return reply.send({
      success: true,
      users: users.map((user) => ({ ...user, telegramId: user.telegramId.toString() })),
      total,
      pages: Math.ceil(total / take),
    })
  })

  app.patch('/users/:id/role', { preHandler: adminOnly }, async (req: any, reply: any) => {
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

  app.get('/locations', { preHandler: adminOnly }, async (_req: any, reply: any) => {
    const locations = await prisma.location.findMany({
      include: {
        workingHours: true,
        _count: { select: { products: true, orders: true } },
      },
      orderBy: { id: 'asc' },
    })

    return reply.send({
      success: true,
      locations: locations.map((location) => {
        const profile = getLocationProfile(location)
        return {
          ...location,
          posterToken: undefined,
          format: profile.format,
          posSystem: profile.posSystem,
          menuManagement: profile.menuManagement,
          paymentFlow: profile.paymentFlow,
          remoteOrderingEnabled: profile.remoteOrderingEnabled,
        }
      }),
    })
  })

  app.patch('/locations/:id', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const id = Number(req.params.id)
    const body = z.object({
      allowOrders: z.boolean().optional(),
      busyMode: z.boolean().optional(),
      maxQueueSize: z.number().int().min(1).max(100).optional(),
      isActive: z.boolean().optional(),
      hasPoster: z.boolean().optional(),
      posterSubdomain: z.string().trim().min(1).optional().nullable(),
      posterAccount: z.string().trim().min(1).optional().nullable(),
      posterSpotId: z.number().int().positive().optional().nullable(),
    }).safeParse(req.body)

    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid data' })

    const data: any = { ...body.data }
    if (data.hasPoster === false) {
      data.posterSubdomain = null
      data.posterAccount = null
      data.posterSpotId = null
    }

    const location = await prisma.location.update({ where: { id }, data })
    return reply.send({ success: true, location: { ...location, posterToken: undefined } })
  })

  app.get('/menu/:locationSlug', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const locationSlug = String(req.params.locationSlug)
    const location = await prisma.location.findUnique({ where: { slug: locationSlug } })
    if (!location) return reply.status(404).send({ success: false, error: 'Location not found' })

    const [products, bundles] = await Promise.all([
      prisma.product.findMany({
        where: { locationId: location.id },
        orderBy: [{ categoryOrder: 'asc' }, { category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.bundle.findMany({
        where: { locationId: location.id },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    ])

    const profile = getLocationProfile(location)
    const categories = mergeStoredCategories(location.menuCategories, products)

    return reply.send({
      success: true,
      location: {
        id: location.id,
        slug: location.slug,
        name: location.name,
        address: location.address,
        format: profile.format,
        posSystem: profile.posSystem,
        menuManagement: profile.menuManagement,
        paymentFlow: profile.paymentFlow,
        remoteOrderingEnabled: profile.remoteOrderingEnabled,
        qrSvgUrl: `/api/menu/${location.slug}/qr.svg`,
        printMenuUrl: `/api/menu/${location.slug}/print`,
      },
      categories,
      products: sortMenuProducts(products),
      bundles,
    })
  })

  app.post('/menu/:locationSlug/reorder-categories', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const locationSlug = String(req.params.locationSlug)
    const body = z.object({ categories: z.array(z.string().trim().min(1)).min(1) }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid data' })

    const location = await prisma.location.findUnique({ where: { slug: locationSlug } })
    if (!location) return reply.status(404).send({ success: false, error: 'Location not found' })

    const categories = uniqueCategoryNames(body.data.categories)
    const orderedCategories = makeCategoryOrder(categories)

    await prisma.$transaction(async (tx) => {
      await tx.location.update({
        where: { id: location.id },
        data: { menuCategories: orderedCategories },
      })

      for (const category of orderedCategories) {
        await tx.product.updateMany({
          where: { locationId: location.id, category: category.name },
          data: { categoryOrder: category.sortOrder },
        })
      }
    })

    await clearLocationMenuCache(locationSlug)
    return reply.send({ success: true, categories: orderedCategories })
  })

  app.post('/menu/:locationSlug/categories', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const locationSlug = String(req.params.locationSlug)
    const body = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid data' })

    const location = await prisma.location.findUnique({ where: { slug: locationSlug } })
    if (!location) return reply.status(404).send({ success: false, error: 'Location not found' })

    try {
      requireManualMenu(location)
    } catch (error) {
      return reply.status(400).send({ success: false, error: (error as Error).message })
    }

    const name = getNormalizedCategory(body.data.name)
    const products = await prisma.product.findMany({ where: { locationId: location.id } })
    const categories = mergeStoredCategories(location.menuCategories, products)

    if (categories.some((category) => category.name === name)) {
      return reply.status(409).send({ success: false, error: 'Category already exists' })
    }

    const next = [...parseStoredCategories(location.menuCategories), { name, sortOrder: getNextCategoryOrder(products) }]
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, 'uk'))

    await prisma.location.update({ where: { id: location.id }, data: { menuCategories: next } })
    await clearLocationMenuCache(locationSlug)

    return reply.send({ success: true, category: { name, sortOrder: next.find((item) => item.name === name)?.sortOrder || 0, count: 0 } })
  })

  app.patch('/menu/:locationSlug/categories', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const locationSlug = String(req.params.locationSlug)
    const body = z.object({
      oldName: z.string().trim().min(1).max(80),
      name: z.string().trim().min(1).max(80),
    }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid data' })

    const location = await prisma.location.findUnique({ where: { slug: locationSlug } })
    if (!location) return reply.status(404).send({ success: false, error: 'Location not found' })

    try {
      requireManualMenu(location)
    } catch (error) {
      return reply.status(400).send({ success: false, error: (error as Error).message })
    }

    const oldName = getNormalizedCategory(body.data.oldName)
    const nextName = getNormalizedCategory(body.data.name)
    const products = await prisma.product.findMany({ where: { locationId: location.id } })
    const categories = mergeStoredCategories(location.menuCategories, products)
    const current = categories.find((category) => category.name === oldName)

    if (!current) return reply.status(404).send({ success: false, error: 'Category not found' })
    if (oldName !== nextName && categories.some((category) => category.name === nextName)) {
      return reply.status(409).send({ success: false, error: 'Category with this name already exists' })
    }

    const nextStored = parseStoredCategories(location.menuCategories).map((category) => (
      category.name === oldName ? { ...category, name: nextName } : category
    ))

    await prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { locationId: location.id, category: oldName },
        data: { category: nextName, categoryOrder: current.sortOrder },
      })

      await tx.location.update({
        where: { id: location.id },
        data: { menuCategories: nextStored },
      })
    })

    await clearLocationMenuCache(locationSlug)
    return reply.send({ success: true, category: { name: nextName, sortOrder: current.sortOrder } })
  })

  app.delete('/menu/:locationSlug/categories/:categoryName', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const locationSlug = String(req.params.locationSlug)
    const categoryName = decodeURIComponent(String(req.params.categoryName))
    const body = z.object({ moveProductsTo: z.string().trim().min(1).optional() }).safeParse(req.body || {})
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid data' })

    const location = await prisma.location.findUnique({ where: { slug: locationSlug } })
    if (!location) return reply.status(404).send({ success: false, error: 'Location not found' })

    try {
      requireManualMenu(location)
    } catch (error) {
      return reply.status(400).send({ success: false, error: (error as Error).message })
    }

    const products = await prisma.product.findMany({ where: { locationId: location.id } })
    const categories = mergeStoredCategories(location.menuCategories, products)
    const existing = categories.find((category) => category.name === categoryName)
    if (!existing) return reply.status(404).send({ success: false, error: 'Category not found' })

    const productsInCategory = products.filter((product) => product.category === categoryName)
    const moveProductsTo = body.data.moveProductsTo ? getNormalizedCategory(body.data.moveProductsTo) : undefined

    if (productsInCategory.length > 0 && !moveProductsTo) {
      return reply.status(400).send({ success: false, error: 'Move products to another category before deleting this category' })
    }

    const nextStoredBase = parseStoredCategories(location.menuCategories).filter((category) => category.name !== categoryName)
    const nextStored = [...nextStoredBase]

    await prisma.$transaction(async (tx) => {
      if (productsInCategory.length > 0 && moveProductsTo) {
        const targetOrder = categories.find((category) => category.name === moveProductsTo)?.sortOrder ?? getNextCategoryOrder(products)
        if (!categories.some((category) => category.name === moveProductsTo)) {
          nextStored.push({ name: moveProductsTo, sortOrder: targetOrder })
        }

        await tx.product.updateMany({
          where: { locationId: location.id, category: categoryName },
          data: { category: moveProductsTo, categoryOrder: targetOrder },
        })
      }

      await tx.location.update({ where: { id: location.id }, data: { menuCategories: nextStored } })
    })

    await clearLocationMenuCache(locationSlug)
    return reply.send({ success: true })
  })

  app.post('/menu/:locationSlug/products', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const locationSlug = String(req.params.locationSlug)
    const body = z.object({
      name: z.string().trim().min(1).max(200),
      price: z.coerce.number().positive(),
      category: z.string().trim().min(1).max(80),
      description: z.string().max(500).optional(),
      ingredients: z.string().max(500).optional(),
      imageUrl: z.string().url().max(1000).optional(),
      volume: z.string().max(50).optional(),
      calories: z.coerce.number().int().min(0).max(5000).optional(),
      isAvailable: z.boolean().optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid data' })

    const location = await prisma.location.findUnique({ where: { slug: locationSlug } })
    if (!location) return reply.status(404).send({ success: false, error: 'Location not found' })

    try {
      requireManualMenu(location)
    } catch (error) {
      return reply.status(400).send({ success: false, error: (error as Error).message })
    }

    const products = await prisma.product.findMany({ where: { locationId: location.id } })
    const categoryName = getNormalizedCategory(body.data.category)
    const categoryOrder = getCategoryOrder(products, categoryName)
    const stored = parseStoredCategories(location.menuCategories)

    if (!stored.some((category) => category.name === categoryName)) {
      stored.push({ name: categoryName, sortOrder: categoryOrder || getNextCategoryOrder(products) })
    }

    const product = await prisma.$transaction(async (tx) => {
      await tx.location.update({ where: { id: location.id }, data: { menuCategories: stored } })

      return tx.product.create({
        data: {
          locationId: location.id,
          name: body.data.name.trim(),
          price: body.data.price,
          category: categoryName,
          categoryOrder: categoryOrder || getNextCategoryOrder(products),
          sortOrder: getNextProductSortOrder(products, categoryName),
          description: body.data.description?.trim() || null,
          ingredients: body.data.ingredients?.trim() || null,
          imageUrl: body.data.imageUrl?.trim() || null,
          volume: body.data.volume?.trim() || null,
          calories: body.data.calories,
          isAvailable: body.data.isAvailable ?? true,
          allergens: [],
          tags: [],
        },
      })
    })

    await clearLocationMenuCache(locationSlug)
    return reply.send({ success: true, product })
  })

  app.post('/menu/:locationSlug/reorder-products', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const locationSlug = String(req.params.locationSlug)
    const body = z.object({ productIds: z.array(z.number().int().positive()).min(1) }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid data' })

    const location = await prisma.location.findUnique({ where: { slug: locationSlug } })
    if (!location) return reply.status(404).send({ success: false, error: 'Location not found' })

    for (let index = 0; index < body.data.productIds.length; index += 1) {
      await prisma.product.updateMany({
        where: { id: body.data.productIds[index], locationId: location.id },
        data: { sortOrder: index + 1 },
      })
    }

    await clearLocationMenuCache(locationSlug)
    return reply.send({ success: true })
  })

  app.patch('/products/:id', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const id = Number(req.params.id)
    const body = z.object({
      isAvailable: z.boolean().optional(),
      price: z.coerce.number().positive().optional(),
      name: z.string().trim().min(1).max(200).optional(),
      description: z.string().max(500).optional().nullable(),
      category: z.string().trim().min(1).max(80).optional(),
      ingredients: z.string().max(500).optional().nullable(),
      imageUrl: z.string().url().max(1000).optional().nullable(),
      volume: z.string().max(50).optional().nullable(),
      calories: z.coerce.number().int().min(0).max(5000).optional().nullable(),
    }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid data' })

    const product = await prisma.product.findUnique({
      where: { id },
      include: { location: true },
    })
    if (!product) return reply.status(404).send({ success: false, error: 'Product not found' })

    const profile = getLocationProfile(product.location)
    const data: any = {}

    if (body.data.isAvailable !== undefined) data.isAvailable = body.data.isAvailable

    if (profile.menuManagement === 'LOCAL') {
      if (body.data.price !== undefined) data.price = body.data.price
      if (body.data.name !== undefined) data.name = body.data.name.trim()
      if (body.data.description !== undefined) data.description = body.data.description?.trim() || null
      if (body.data.ingredients !== undefined) data.ingredients = body.data.ingredients?.trim() || null
      if (body.data.imageUrl !== undefined) data.imageUrl = body.data.imageUrl?.trim() || null
      if (body.data.volume !== undefined) data.volume = body.data.volume?.trim() || null
      if (body.data.calories !== undefined) data.calories = body.data.calories
    } else if (Object.keys(body.data).some((key) => key !== 'isAvailable')) {
      return reply.status(400).send({ success: false, error: 'Poster menu supports availability only. Edit products in Poster for full changes.' })
    }

    if (profile.menuManagement === 'LOCAL' && body.data.category && body.data.category !== product.category) {
      const nextCategory = getNormalizedCategory(body.data.category)
      const products = await prisma.product.findMany({ where: { locationId: product.locationId } })
      const stored = parseStoredCategories(product.location.menuCategories)
      const categoryOrder = getCategoryOrder(products, nextCategory) || getNextCategoryOrder(products)
      if (!stored.some((category) => category.name === nextCategory)) {
        stored.push({ name: nextCategory, sortOrder: categoryOrder })
        await prisma.location.update({ where: { id: product.locationId }, data: { menuCategories: stored } })
      }
      data.category = nextCategory
      data.categoryOrder = categoryOrder
      data.sortOrder = getNextProductSortOrder(products.filter((item) => item.id !== product.id), nextCategory)
    }

    const updated = await prisma.product.update({ where: { id }, data })
    await clearLocationMenuCache(product.location.slug)
    return reply.send({ success: true, product: updated })
  })

  app.delete('/products/:id', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const id = Number(req.params.id)
    const product = await prisma.product.findUnique({ where: { id }, include: { location: true } })
    if (!product) return reply.status(404).send({ success: false, error: 'Product not found' })

    try {
      requireManualMenu(product.location)
    } catch (error) {
      return reply.status(400).send({ success: false, error: (error as Error).message })
    }

    await prisma.product.delete({ where: { id } })
    await clearLocationMenuCache(product.location.slug)
    return reply.send({ success: true })
  })

  app.post('/sync', { preHandler: adminOnly }, async (_req: any, reply: any) => {
    syncAllLocations().catch((error) => console.error('[Admin sync error]', error))
    return reply.send({ success: true, message: 'Sync started' })
  })

  app.post('/sync/:slug', { preHandler: adminOnly }, async (req: any, reply: any) => {
    const slug = String(req.params.slug)
    try {
      const result = await syncPosterMenu(slug)
      return reply.send({ success: true, ...result })
    } catch (error: any) {
      return reply.status(500).send({ success: false, error: error.message })
    }
  })

  app.post('/db-push', { preHandler: adminOnly }, async (_req: any, reply: any) => {
    const results: string[] = []
    const run = async (sql: string, label: string) => {
      try {
        await prisma.$executeRawUnsafe(sql)
        results.push('OK: ' + label)
      } catch (error: any) {
        results.push('SKIP: ' + label + ' (' + error.message.split('\n')[0] + ')')
      }
    }

    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "hasPoster" BOOLEAN NOT NULL DEFAULT false', 'Location.hasPoster')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "menuCategories" JSONB', 'Location.menuCategories')
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
    await run('ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "categoryOrder" INTEGER NOT NULL DEFAULT 0', 'Product.categoryOrder')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP', 'User.birthDate')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastBirthdayBonus" INTEGER', 'User.lastBirthdayBonus')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredById" INTEGER', 'User.referredById')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralBonusPaid" BOOLEAN NOT NULL DEFAULT false', 'User.referralBonusPaid')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredLocationId" INTEGER', 'User.preferredLocationId')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT', 'User.phone')
    await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'uk'`, 'User.language')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "noShowCount" INTEGER NOT NULL DEFAULT 0', 'User.noShowCount')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cashPaymentBlocked" BOOLEAN NOT NULL DEFAULT false', 'User.cashPaymentBlocked')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifSpin" BOOLEAN NOT NULL DEFAULT true', 'User.notifSpin')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifWinback" BOOLEAN NOT NULL DEFAULT true', 'User.notifWinback')
    await run(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "radioGenre" TEXT DEFAULT 'all'`, 'User.radioGenre')

    return reply.send({ success: true, results })
  })

  app.get('/db-check', { preHandler: adminOnly }, async (_req: any, reply: any) => {
    const krona = await prisma.location.findUnique({ where: { slug: 'krona' } })
    const pryozerny = await prisma.location.findUnique({ where: { slug: 'pryozerny' } })
    const kronaCount = krona ? await prisma.product.count({ where: { locationId: krona.id } }) : 0
    const pryCount = pryozerny ? await prisma.product.count({ where: { locationId: pryozerny.id } }) : 0
    return reply.send({ success: true, kronaCount, pryCount })
  })
}