import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireBarista } from '../plugins/auth'

const ORDER_STATUSES = ['PAYMENT_PENDING', 'PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'AUTO_EXPIRED', 'UNASSIGNED'] as const

const createOrderSchema = z.object({
  locationId: z.number().int().positive(),
  paymentMethod: z.enum(['cash', 'card']).default('card'),
  pointsToUse: z.number().int().min(0).default(0),
  pickupTime: z.string().datetime().optional(),
  comment: z.string().max(500).optional(),
  items: z.array(z.object({
    productId: z.number().int().positive().optional(),
    bundleId: z.number().int().positive().optional(),
    quantity: z.number().int().min(1).max(20).default(1),
    modifiers: z.record(z.string(), z.string()).optional(),
  }).refine(v => !!v.productId || !!v.bundleId, 'productId or bundleId required')).min(1),
})

const paySchema = z.object({
  paymentId: z.string().min(3),
})

const statusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  estimatedReady: z.string().datetime().optional(),
})

export default async function orderRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: authenticate }, async (req, reply) => {
    const parsed = createOrderSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: parsed.error.flatten() })
    }

    const { locationId, items, paymentMethod, pointsToUse, pickupTime, comment } = parsed.data

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return reply.status(404).send({ success: false, error: 'User not found' })

    const location = await prisma.location.findUnique({ where: { id: locationId } })
    if (!location || !location.isActive) return reply.status(404).send({ success: false, error: 'Location not found' })
    if (!location.allowOrders) return reply.status(400).send({ success: false, error: 'Orders are disabled for this location' })

    if (pickupTime && paymentMethod === 'cash') {
      return reply.status(400).send({ success: false, error: 'Cash is available only for immediate orders' })
    }

    const productIds = [...new Set(items.map(i => i.productId).filter(Boolean))] as number[]
    const bundleIds = [...new Set(items.map(i => i.bundleId).filter(Boolean))] as number[]

    const [products, bundles] = await Promise.all([
      productIds.length
        ? prisma.product.findMany({ where: { id: { in: productIds }, locationId, isAvailable: true } })
        : Promise.resolve([]),
      bundleIds.length
        ? prisma.bundle.findMany({ where: { id: { in: bundleIds }, locationId, isAvailable: true } })
        : Promise.resolve([]),
    ])

    const productMap = new Map(products.map(p => [p.id, p]))
    const bundleMap = new Map(bundles.map(b => [b.id, b]))

    let subtotal = 0
    const preparedItems: Array<{
      productId?: number
      bundleId?: number
      name: string
      price: number
      quantity: number
      modifiers?: Record<string, string>
    }> = []

    for (const item of items) {
      const quantity = item.quantity || 1
      if (item.productId) {
        const product = productMap.get(item.productId)
        if (!product) return reply.status(400).send({ success: false, error: `Product ${item.productId} unavailable` })
        const price = Number(product.price)
        subtotal += price * quantity
        preparedItems.push({ productId: product.id, name: product.name, price, quantity, modifiers: item.modifiers })
      } else if (item.bundleId) {
        const bundle = bundleMap.get(item.bundleId)
        if (!bundle) return reply.status(400).send({ success: false, error: `Bundle ${item.bundleId} unavailable` })
        const price = Number(bundle.price)
        subtotal += price * quantity
        preparedItems.push({ bundleId: bundle.id, name: bundle.name, price, quantity, modifiers: item.modifiers })
      }
    }

    const maxPointsUsable = Math.min(pointsToUse, user.points, Math.floor(subtotal * 10)) // 10 points = 1 UAH
    const discount = maxPointsUsable / 10
    const total = Math.max(0, subtotal - discount)

    const activeShift = await prisma.shift.findFirst({ where: { locationId, endedAt: null }, orderBy: { startedAt: 'desc' } })

    const result = await prisma.$transaction(async (tx) => {
      const initialStatus = paymentMethod === 'cash'
        ? (activeShift ? 'PENDING' : 'UNASSIGNED')
        : 'PAYMENT_PENDING'

      const order = await tx.order.create({
        data: {
          userId: user.id,
          locationId,
          shiftId: activeShift?.id,
          status: initialStatus,
          total,
          discount,
          pointsUsed: maxPointsUsable,
          paymentMethod,
          pickupTime: pickupTime ? new Date(pickupTime) : null,
          comment,
          items: {
            create: preparedItems.map(i => ({
              productId: i.productId,
              bundleId: i.bundleId,
              name: i.name,
              price: i.price,
              quantity: i.quantity,
              modifiers: i.modifiers,
            })),
          },
        },
        include: { items: true },
      })

      if (paymentMethod === 'cash' && maxPointsUsable > 0) {
        await tx.user.update({ where: { id: user.id }, data: { points: { decrement: maxPointsUsable } } })
        await tx.pointsTransaction.create({
          data: {
            userId: user.id,
            amount: -maxPointsUsable,
            type: 'ORDER',
            description: `Списання балів за замовлення #${order.id}`,
            idempotencyKey: `order-points-cash-${order.id}`,
          },
        })
      }

      return order
    })

    return reply.status(201).send({ success: true, order: result })
  })

  app.post('/:id/pay', { preHandler: authenticate }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    const parsed = paySchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.flatten() })

    const order = await prisma.order.findUnique({ where: { id } })
    if (!order || order.userId !== req.user.id) return reply.status(404).send({ success: false, error: 'Order not found' })
    if (order.status !== 'PAYMENT_PENDING') return reply.status(400).send({ success: false, error: 'Order is not awaiting payment' })

    const activeShift = await prisma.shift.findFirst({ where: { locationId: order.locationId, endedAt: null }, orderBy: { startedAt: 'desc' } })

    const updated = await prisma.$transaction(async (tx) => {
      if (order.pointsUsed > 0) {
        await tx.user.update({ where: { id: req.user.id }, data: { points: { decrement: order.pointsUsed } } })
        await tx.pointsTransaction.create({
          data: {
            userId: req.user.id,
            amount: -order.pointsUsed,
            type: 'ORDER',
            description: `Списання балів за замовлення #${order.id}`,
            idempotencyKey: `order-points-card-${order.id}`,
          },
        })
      }

      return tx.order.update({
        where: { id: order.id },
        data: {
          paymentId: parsed.data.paymentId,
          status: activeShift ? 'PENDING' : 'UNASSIGNED',
          shiftId: activeShift?.id,
        },
      })
    })

    return reply.send({ success: true, order: updated })
  })

  app.get('/', { preHandler: authenticate }, async (req, reply) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: true, location: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })
    return reply.send({ success: true, orders })
  })

  app.get('/:id', { preHandler: authenticate }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true, location: true, shift: true },
    })
    if (!order) return reply.status(404).send({ success: false, error: 'Order not found' })

    const canView = order.userId === req.user.id || ['BARISTA', 'ADMIN', 'OWNER'].includes(req.user.role)
    if (!canView) return reply.status(403).send({ success: false, error: 'Forbidden' })

    return reply.send({ success: true, order })
  })

  app.delete('/:id', { preHandler: authenticate }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    const order = await prisma.order.findUnique({ where: { id } })
    if (!order || order.userId !== req.user.id) return reply.status(404).send({ success: false, error: 'Order not found' })

    const ageMs = Date.now() - order.createdAt.getTime()
    if (ageMs > 2 * 60 * 1000) return reply.status(400).send({ success: false, error: 'Cancellation window is over' })
    if (!['PAYMENT_PENDING', 'PENDING', 'UNASSIGNED'].includes(order.status)) {
      return reply.status(400).send({ success: false, error: 'Cannot cancel in current status' })
    }

    const cancelled = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({ where: { id }, data: { status: 'CANCELLED' } })
      if (order.pointsUsed > 0 && order.paymentMethod !== 'cash') {
        await tx.user.update({ where: { id: req.user.id }, data: { points: { increment: order.pointsUsed } } })
        await tx.pointsTransaction.create({
          data: {
            userId: req.user.id,
            amount: order.pointsUsed,
            type: 'BONUS',
            description: `Повернення балів за скасування #${order.id}`,
            idempotencyKey: `order-cancel-refund-${order.id}`,
          },
        })
      }
      return updated
    })

    return reply.send({ success: true, order: cancelled })
  })

  app.patch('/:id/status', { preHandler: await requireBarista }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    const parsed = statusSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.flatten() })

    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) return reply.status(404).send({ success: false, error: 'Order not found' })

    if (req.user.role === 'BARISTA') {
      const activeShift = await prisma.shift.findFirst({ where: { userId: req.user.id, endedAt: null } })
      if (!activeShift) return reply.status(400).send({ success: false, error: 'Start shift first' })
      if (activeShift.locationId !== order.locationId) {
        return reply.status(403).send({ success: false, error: 'This order belongs to another location' })
      }
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: parsed.data.status,
        estimatedReady: parsed.data.estimatedReady ? new Date(parsed.data.estimatedReady) : undefined,
      },
    })

    return reply.send({ success: true, order: updated })
  })
}
