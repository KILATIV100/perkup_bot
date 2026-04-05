import { randomUUID } from 'crypto'
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate, requireBarista } from '../plugins/auth'

const createOrderSchema = z.object({
  locationId: z.number().int().positive(),
  paymentMethod: z.enum(['cash', 'card']).default('cash'),
  comment: z.string().max(500).optional(),
  items: z.array(z.object({
    productId: z.number().int().positive().optional(),
    bundleId: z.number().int().positive().optional(),
    quantity: z.number().int().min(1).max(20).default(1),
    modifiers: z.record(z.string(), z.string()).optional(),
  }).refine(v => !!v.productId || !!v.bundleId, 'productId or bundleId required')).min(1),
})

const statusSchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'AUTO_EXPIRED', 'UNASSIGNED']),
  estimatedReady: z.string().datetime().optional(),
})

function isLocationOpen(workingHours: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>): boolean {
  const now = new Date()
  const kyiv = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }))
  const day = kyiv.getDay()
  const hh = String(kyiv.getHours()).padStart(2, '0')
  const mm = String(kyiv.getMinutes()).padStart(2, '0')
  const time = `${hh}:${mm}`

  const today = workingHours.find((h) => h.dayOfWeek === day)
  if (!today || today.isClosed) return false
  return time >= today.openTime && time < today.closeTime
}

async function notifyOwnerAboutNewOrder(payload: {
  orderId: number
  locationName: string
  items: Array<{ name: string; quantity: number; price: number }>
  total: number
  paymentMethod: string
}) {
  const token = process.env.BOT_TOKEN
  const ownerTelegramId = process.env.OWNER_TELEGRAM_ID
  if (!token || !ownerTelegramId) return

  const lines = payload.items.map((i) => `• ${i.name} × ${i.quantity} — ${Math.round(i.price * i.quantity)} ₴`).join('\n')
  const text =
    `🔔 Нове замовлення #${payload.orderId}\n` +
    `📍 ${payload.locationName}\n` +
    `${lines}\n` +
    `💰 Разом: ${Math.round(payload.total)} ₴\n` +
    `💳 Оплата: ${payload.paymentMethod === 'card' ? 'картка' : 'готівка'}`

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: Number(ownerTelegramId),
      text,
    }),
  })
}

export default async function orderRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: authenticate }, async (req, reply) => {
    const parsed = createOrderSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.flatten() })

    const { locationId, items, paymentMethod, comment } = parsed.data

    const location = await prisma.location.findUnique({ where: { id: locationId }, include: { workingHours: true } })
    if (!location || !location.isActive) return reply.status(404).send({ success: false, error: 'Location not found' })
    if (!location.allowOrders) return reply.status(400).send({ success: false, error: 'Location does not accept orders' })
    if (!isLocationOpen(location.workingHours)) return reply.status(400).send({ success: false, error: 'Location is closed now' })

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

    let total = 0
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
        total += price * quantity
        preparedItems.push({ productId: product.id, name: product.name, price, quantity, modifiers: item.modifiers })
      } else if (item.bundleId) {
        const bundle = bundleMap.get(item.bundleId)
        if (!bundle) return reply.status(400).send({ success: false, error: `Bundle ${item.bundleId} unavailable` })
        const price = Number(bundle.price)
        total += price * quantity
        preparedItems.push({ bundleId: bundle.id, name: bundle.name, price, quantity, modifiers: item.modifiers })
      }
    }

    const qrCode = `ORD-${randomUUID()}`

    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
        locationId,
        status: 'PENDING',
        total,
        paymentMethod,
        comment,
        qrCode,
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
      include: { items: true, location: { select: { name: true } } },
    })

    await notifyOwnerAboutNewOrder({
      orderId: order.id,
      locationName: order.location.name,
      items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, price: Number(i.price) })),
      total: Number(order.total),
      paymentMethod: order.paymentMethod,
    })

    return reply.status(201).send({
      success: true,
      orderId: order.id,
      qrCode: order.qrCode,
      total: Number(order.total),
      status: order.status,
    })
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
    const order = await prisma.order.findUnique({ where: { id }, include: { items: true, location: true } })
    if (!order) return reply.status(404).send({ success: false, error: 'Order not found' })

    const canView = order.userId === req.user.id || ['BARISTA', 'ADMIN', 'OWNER'].includes(req.user.role)
    if (!canView) return reply.status(403).send({ success: false, error: 'Forbidden' })

    return reply.send({ success: true, order })
  })

  app.delete('/:id', { preHandler: authenticate }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    const order = await prisma.order.findUnique({ where: { id } })
    if (!order || order.userId !== req.user.id) return reply.status(404).send({ success: false, error: 'Order not found' })

    if (!['PENDING', 'UNASSIGNED'].includes(order.status)) {
      return reply.status(400).send({ success: false, error: 'Cannot cancel in current status' })
    }

    const cancelled = await prisma.order.update({ where: { id }, data: { status: 'CANCELLED' } })
    return reply.send({ success: true, order: cancelled })
  })

  app.patch('/:id/status', { preHandler: await requireBarista }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id)
    const parsed = statusSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error.flatten() })

    const order = await prisma.order.findUnique({ where: { id } })
    if (!order) return reply.status(404).send({ success: false, error: 'Order not found' })

    const updated = await prisma.$transaction(async (tx) => {
      const o = await tx.order.update({
        where: { id },
        data: {
          status: parsed.data.status,
          estimatedReady: parsed.data.estimatedReady ? new Date(parsed.data.estimatedReady) : undefined,
        },
      })

      if (parsed.data.status === 'COMPLETED') {
        const points = Math.floor(Number(o.total) / 10)
        if (points > 0) {
          await tx.user.update({ where: { id: o.userId }, data: { points: { increment: points } } })
          await tx.pointsTransaction.upsert({
            where: { idempotencyKey: `order-completed-points-${o.id}` },
            update: {},
            create: {
              userId: o.userId,
              amount: points,
              type: 'ORDER',
              description: `Бали за замовлення #${o.id}`,
              idempotencyKey: `order-completed-points-${o.id}`,
            },
          })
        }
      }

      return o
    })

    return reply.send({ success: true, order: updated })
  })
}
