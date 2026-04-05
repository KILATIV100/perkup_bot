import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { redisCache } from '../lib/redis'

const OWNER_TELEGRAM_ID = process.env.OWNER_TELEGRAM_ID || '7363233852'
const BOT_TOKEN = process.env.BOT_TOKEN || ''

async function notifyOwner(text: string) {
  if (!BOT_TOKEN) return
  try {
    await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: OWNER_TELEGRAM_ID, text, parse_mode: 'Markdown' }),
    })
  } catch (e) {
    console.error('Notify owner error:', e)
  }
}

async function notifyUser(telegramId: string, text: string) {
  if (!BOT_TOKEN) return
  try {
    await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramId, text, parse_mode: 'Markdown' }),
    })
  } catch (e) {
    console.error('Notify user error:', e)
  }
}

function isLocationOpen(workingHours: any[]): boolean {
  const now = new Date()
  const kyivNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  const day = kyivNow.getUTCDay()
  const timeStr = kyivNow.getUTCHours().toString().padStart(2, '0') + ':' + kyivNow.getUTCMinutes().toString().padStart(2, '0')
  const todayHours = workingHours.find((h: any) => h.dayOfWeek === day)
  if (!todayHours || todayHours.isClosed) return false
  return timeStr >= todayHours.openTime && timeStr < todayHours.closeTime
}

export default async function orderRoutes(app: FastifyInstance) {

  // Auth middleware helper
  async function auth(req: any, reply: any) {
    try { await req.jwtVerify() } catch { return reply.status(401).send({ success: false, error: 'Unauthorized' }) }
  }

  // POST /api/orders — create order
  app.post('/', { preHandler: auth }, async (req: any, reply) => {
    const body = z.object({
      locationId: z.number(),
      items: z.array(z.object({
        productId: z.number().optional(),
        bundleId: z.number().optional(),
        quantity: z.number().min(1).max(20),
        modifiers: z.record(z.string()).optional(),
      })).min(1),
      paymentMethod: z.enum(['cash', 'card']).default('cash'),
      comment: z.string().max(300).optional(),
      pointsUsed: z.number().min(0).default(0),
    }).safeParse(req.body)

    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid request', details: body.error.flatten() })

    const { locationId, items, paymentMethod, comment, pointsUsed } = body.data

    // 1. Check location
    const location = await prisma.location.findUnique({
      where: { id: locationId, isActive: true },
      include: { workingHours: true },
    })
    if (!location) return reply.status(404).send({ success: false, error: 'Локацію не знайдено' })
    if (!location.allowOrders) return reply.status(400).send({ success: false, error: 'Ця локація не приймає замовлення' })
    if (!isLocationOpen(location.workingHours)) return reply.status(400).send({ success: false, error: 'Кав'ярня зараз зачинена' })

    // 2. Get user
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return reply.status(404).send({ success: false, error: 'Користувача не знайдено' })

    // 3. Validate items & calculate total
    let total = 0
    const orderItems: any[] = []

    for (const item of items) {
      if (item.productId) {
        const product = await prisma.product.findUnique({ where: { id: item.productId } })
        if (!product || !product.isAvailable || product.locationId !== locationId) {
          return reply.status(400).send({ success: false, error: 'Товар недоступний: ' + (product?.name || item.productId) })
        }
        const price = Number(product.price)
        total += price * item.quantity
        orderItems.push({ productId: product.id, name: product.name, price, quantity: item.quantity, modifiers: item.modifiers || null })
      } else if (item.bundleId) {
        const bundle = await prisma.bundle.findUnique({ where: { id: item.bundleId } })
        if (!bundle || !bundle.isAvailable || bundle.locationId !== locationId) {
          return reply.status(400).send({ success: false, error: 'Набір недоступний' })
        }
        const price = Number(bundle.price)
        total += price * item.quantity
        orderItems.push({ bundleId: bundle.id, name: bundle.name, price, quantity: item.quantity, modifiers: null })
      }
    }

    // 4. Points discount (100 points = 1 order item free, max 50% discount)
    let discount = 0
    if (pointsUsed > 0) {
      if (user.points < pointsUsed) return reply.status(400).send({ success: false, error: 'Недостатньо балів' })
      discount = Math.min(pointsUsed, Math.floor(total * 0.5))
    }
    const finalTotal = Math.max(0, total - discount)

    // 5. Generate QR code
    const qrCode = 'PU-' + crypto.randomBytes(6).toString('hex').toUpperCase()

    // 6. Create order in DB
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        locationId,
        status: 'PENDING',
        total: finalTotal,
        discount,
        paymentMethod,
        comment: comment || null,
        pointsUsed,
        qrCode,
        items: { create: orderItems },
      },
      include: { items: true },
    })

    // 7. Deduct points if used
    if (pointsUsed > 0) {
      await prisma.user.update({ where: { id: user.id }, data: { points: { decrement: pointsUsed } } })
      await prisma.pointsTransaction.create({
        data: {
          userId: user.id, amount: -pointsUsed, type: 'REDEEM',
          description: 'Списання балів за замовлення #' + order.id,
          idempotencyKey: 'redeem-order-' + order.id,
        },
      })
    }

    // 8. Clear menu cache
    await redisCache.del('menu:' + location.slug)

    // 9. Notify owner
    const itemsText = orderItems.map(i => '• ' + i.name + ' × ' + i.quantity + ' — ' + (i.price * i.quantity) + ' ₴').join('\n')
    await notifyOwner(
      '🔔 *Нове замовлення #' + order.id + '*\n' +
      '📍 ' + location.name + '\n\n' +
      itemsText + '\n\n' +
      (discount > 0 ? '🎁 Знижка балами: -' + discount + ' ₴\n' : '') +
      '💰 *Разом: ' + finalTotal + ' ₴*\n' +
      '💳 Оплата: ' + (paymentMethod === 'cash' ? 'готівка' : 'картка') + '\n' +
      (comment ? '💬 ' + comment + '\n' : '') +
      '🔑 QR: ' + qrCode
    )

    return reply.send({ success: true, orderId: order.id, qrCode, total: finalTotal, status: 'PENDING' })
  })

  // GET /api/orders — my orders
  app.get('/', { preHandler: auth }, async (req: any, reply) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: true, location: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return reply.send({ success: true, orders })
  })

  // GET /api/orders/:id — order status
  app.get('/:id', { preHandler: auth }, async (req: any, reply) => {
    const id = parseInt((req.params as any).id)
    const order = await prisma.order.findFirst({
      where: { id, userId: req.user.id },
      include: { items: true, location: { select: { name: true, slug: true } } },
    })
    if (!order) return reply.status(404).send({ success: false, error: 'Замовлення не знайдено' })
    return reply.send({ success: true, order })
  })

  // DELETE /api/orders/:id — cancel
  app.delete('/:id', { preHandler: auth }, async (req: any, reply) => {
    const id = parseInt((req.params as any).id)
    const order = await prisma.order.findFirst({ where: { id, userId: req.user.id } })
    if (!order) return reply.status(404).send({ success: false, error: 'Замовлення не знайдено' })
    if (!['PENDING', 'PAYMENT_PENDING'].includes(order.status)) {
      return reply.status(400).send({ success: false, error: 'Замовлення вже не можна скасувати' })
    }
    await prisma.order.update({ where: { id }, data: { status: 'CANCELLED' } })
    return reply.send({ success: true, message: 'Замовлення скасовано' })
  })

  // PATCH /api/orders/:id/status — update status (barista/admin)
  app.patch('/:id/status', { preHandler: auth }, async (req: any, reply) => {
    if (!['BARISTA', 'ADMIN', 'OWNER'].includes(req.user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden' })
    }
    const id = parseInt((req.params as any).id)
    const body = z.object({ status: z.enum(['ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']) }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid status' })

    const order = await prisma.order.findUnique({ where: { id }, include: { user: true } })
    if (!order) return reply.status(404).send({ success: false, error: 'Не знайдено' })

    await prisma.order.update({ where: { id }, data: { status: body.data.status } })

    // Accrue points on COMPLETED (1 point per 10 UAH)
    if (body.data.status === 'COMPLETED') {
      const points = Math.floor(Number(order.total) / 10)
      if (points > 0) {
        const key = 'order-complete-' + id
        const exists = await prisma.pointsTransaction.findUnique({ where: { idempotencyKey: key } })
        if (!exists) {
          await prisma.pointsTransaction.create({
            data: { userId: order.userId, amount: points, type: 'ORDER', description: 'Бали за замовлення #' + id, idempotencyKey: key },
          })
          await prisma.user.update({ where: { id: order.userId }, data: { points: { increment: points }, monthlyOrders: { increment: 1 } } })
          await notifyUser(String(order.user.telegramId), '⭐ Нараховано *' + points + ' балів* за замовлення #' + id + '!')
        }
      }
    }

    // Notify user about status change
    const statusMessages: Record<string, string> = {
      ACCEPTED: '✅ Замовлення #' + id + ' прийнято! Готуємо твою каву ☕',
      READY: '☕ Замовлення #' + id + ' готове! Забирай 🎉',
      CANCELLED: '❌ Замовлення #' + id + ' скасовано.',
    }
    if (statusMessages[body.data.status]) {
      await notifyUser(String(order.user.telegramId), statusMessages[body.data.status])
    }

    return reply.send({ success: true, status: body.data.status })
  })
}
