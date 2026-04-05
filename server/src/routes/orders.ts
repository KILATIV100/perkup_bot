import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { redisCache } from '../lib/redis'

const OWNER_TELEGRAM_ID = process.env.OWNER_TELEGRAM_ID || '7363233852'
const BOT_TOKEN = process.env.BOT_TOKEN || ''

async function sendTelegram(chatId: string, text: string) {
  if (!BOT_TOKEN) return
  try {
    await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch (e) {
    console.error('Telegram error:', e)
  }
}

function isOpen(workingHours: any[]): boolean {
  const kyivNow = new Date(Date.now() + 2 * 3600000)
  const day = kyivNow.getUTCDay()
  const hh = kyivNow.getUTCHours().toString().padStart(2, '0')
  const mm = kyivNow.getUTCMinutes().toString().padStart(2, '0')
  const t = hh + ':' + mm
  const wh = workingHours.find((h: any) => h.dayOfWeek === day)
  if (!wh || wh.isClosed) return false
  return t >= wh.openTime && t < wh.closeTime
}

export default async function orderRoutes(app: FastifyInstance) {

  async function auth(req: any, reply: any) {
    try { await req.jwtVerify() } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }
  }

  app.post('/', { preHandler: auth }, async (req: any, reply: any) => {
    const parsed = z.object({
      locationId:    z.number(),
      items:         z.array(z.object({
        productId: z.number().optional(),
        bundleId:  z.number().optional(),
        quantity:  z.number().min(1).max(20),
        modifiers: z.record(z.string()).optional(),
      })).min(1),
      paymentMethod: z.enum(['cash', 'card']).default('cash'),
      comment:       z.string().max(300).optional(),
      pointsUsed:    z.number().min(0).default(0),
    }).safeParse(req.body)

    if (!parsed.success) return reply.status(400).send({ success: false, error: 'Invalid request' })
    const { locationId, items, paymentMethod, comment, pointsUsed } = parsed.data

    const location = await prisma.location.findUnique({ where: { id: locationId, isActive: true }, include: { workingHours: true } })
    if (!location)           return reply.status(404).send({ success: false, error: 'Локацію не знайдено' })
    if (!location.allowOrders) return reply.status(400).send({ success: false, error: 'Ця локація не приймає замовлення' })
    if (!isOpen(location.workingHours)) return reply.status(400).send({ success: false, error: 'Зараз зачинено' })

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return reply.status(404).send({ success: false, error: 'Користувача не знайдено' })

    let total = 0
    const orderItems: any[] = []

    for (const item of items) {
      if (item.productId) {
        const p = await prisma.product.findUnique({ where: { id: item.productId } })
        if (!p || !p.isAvailable || p.locationId !== locationId) {
          return reply.status(400).send({ success: false, error: 'Товар недоступний: ' + (p?.name || item.productId) })
        }
        const price = Number(p.price)
        total += price * item.quantity
        orderItems.push({ productId: p.id, name: p.name, price, quantity: item.quantity, modifiers: item.modifiers || null })
      } else if (item.bundleId) {
        const b = await prisma.bundle.findUnique({ where: { id: item.bundleId } })
        if (!b || !b.isAvailable || b.locationId !== locationId) {
          return reply.status(400).send({ success: false, error: 'Набір недоступний' })
        }
        const price = Number(b.price)
        total += price * item.quantity
        orderItems.push({ bundleId: b.id, name: b.name, price, quantity: item.quantity, modifiers: null })
      }
    }

    let discount = 0
    if (pointsUsed > 0) {
      if (user.points < pointsUsed) return reply.status(400).send({ success: false, error: 'Недостатньо балів' })
      discount = Math.min(pointsUsed, Math.floor(total * 0.5))
    }
    const finalTotal = Math.max(0, total - discount)
    const qrCode = 'PU-' + crypto.randomBytes(6).toString('hex').toUpperCase()

    const order = await prisma.order.create({
      data: {
        userId: user.id, locationId, status: 'PENDING',
        total: finalTotal, discount, paymentMethod,
        comment: comment || null, pointsUsed, qrCode,
        items: { create: orderItems },
      },
      include: { items: true },
    })

    if (pointsUsed > 0) {
      await prisma.user.update({ where: { id: user.id }, data: { points: { decrement: pointsUsed } } })
      await prisma.pointsTransaction.create({ data: {
        userId: user.id, amount: -pointsUsed, type: 'REDEEM',
        description: 'Списання балів за замовлення #' + order.id,
        idempotencyKey: 'redeem-order-' + order.id,
      }})
    }

    await redisCache.del('menu:' + location.slug)

    const lines = orderItems.map((i: any) => '* ' + i.name + ' x' + i.quantity + ' - ' + (i.price * i.quantity) + ' грн')
    const msg = [
      '🔔 *Нове замовлення #' + order.id + '*',
      '📍 ' + location.name,
      '',
      lines.join('
'),
      '',
      discount > 0 ? '🎁 Знижка: -' + discount + ' грн' : '',
      '💰 *Разом: ' + finalTotal + ' грн*',
      '💳 ' + (paymentMethod === 'cash' ? 'Готівка' : 'Картка'),
      comment ? '💬 ' + comment : '',
      '🔑 ' + qrCode,
    ].filter(Boolean).join('
')

    await sendTelegram(OWNER_TELEGRAM_ID, msg)
    return reply.send({ success: true, orderId: order.id, qrCode, total: finalTotal, status: 'PENDING' })
  })

  app.get('/', { preHandler: auth }, async (req: any, reply: any) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: true, location: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'desc' }, take: 20,
    })
    return reply.send({ success: true, orders })
  })

  app.get('/:id', { preHandler: auth }, async (req: any, reply: any) => {
    const id = parseInt((req.params as any).id)
    const order = await prisma.order.findFirst({
      where: { id, userId: req.user.id },
      include: { items: true, location: { select: { name: true, slug: true } } },
    })
    if (!order) return reply.status(404).send({ success: false, error: 'Замовлення не знайдено' })
    return reply.send({ success: true, order })
  })

  app.delete('/:id', { preHandler: auth }, async (req: any, reply: any) => {
    const id = parseInt((req.params as any).id)
    const order = await prisma.order.findFirst({ where: { id, userId: req.user.id } })
    if (!order) return reply.status(404).send({ success: false, error: 'Не знайдено' })
    if (!['PENDING', 'PAYMENT_PENDING'].includes(order.status)) {
      return reply.status(400).send({ success: false, error: 'Не можна скасувати' })
    }
    await prisma.order.update({ where: { id }, data: { status: 'CANCELLED' } })
    return reply.send({ success: true })
  })

  app.patch('/:id/status', { preHandler: auth }, async (req: any, reply: any) => {
    if (!['BARISTA', 'ADMIN', 'OWNER'].includes(req.user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden' })
    }
    const id = parseInt((req.params as any).id)
    const parsed = z.object({
      status: z.enum(['ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']),
    }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: 'Invalid status' })

    const order = await prisma.order.findUnique({ where: { id }, include: { user: true } })
    if (!order) return reply.status(404).send({ success: false, error: 'Не знайдено' })

    await prisma.order.update({ where: { id }, data: { status: parsed.data.status } })

    if (parsed.data.status === 'COMPLETED') {
      const pts = Math.floor(Number(order.total) / 10)
      if (pts > 0) {
        const key = 'order-complete-' + id
        const exists = await prisma.pointsTransaction.findUnique({ where: { idempotencyKey: key } })
        if (!exists) {
          await prisma.pointsTransaction.create({ data: {
            userId: order.userId, amount: pts, type: 'ORDER',
            description: 'Бали за замовлення #' + id, idempotencyKey: key,
          }})
          await prisma.user.update({ where: { id: order.userId }, data: { points: { increment: pts }, monthlyOrders: { increment: 1 } } })
          await sendTelegram(String(order.user.telegramId), '⭐ Нараховано *' + pts + ' балів* за замовлення #' + id + '!')
        }
      }
    }

    const msgs: Record<string, string> = {
      ACCEPTED:  '✅ Замовлення #' + id + ' прийнято! Готуємо ☕',
      READY:     '☕ Замовлення #' + id + ' готове! Забирай 🎉',
      CANCELLED: '❌ Замовлення #' + id + ' скасовано.',
    }
    if (msgs[parsed.data.status]) await sendTelegram(String(order.user.telegramId), msgs[parsed.data.status])

    return reply.send({ success: true, status: parsed.data.status })
  })
}
