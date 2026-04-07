import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { redisCache } from '../lib/redis'

const OWNER_ID = process.env.OWNER_TELEGRAM_ID || '7363233852'
const BOT = process.env.BOT_TOKEN || ''

async function tgSend(chatId: string, text: string) {
  if (!BOT) return
  try {
    await fetch('https://api.telegram.org/bot' + BOT + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch (e) {
    console.error('tgSend error:', e)
  }
}

function getLevelMultiplier(points: number): number {
  if (points >= 3000) return 1.3
  if (points >= 1000) return 1.2
  if (points >= 300) return 1.1
  return 1.0
}

function calcEarnedPoints(total: number, userPoints: number): number {
  const base = Math.floor(total / 5)
  const multiplier = getLevelMultiplier(userPoints)
  return Math.round(base * multiplier)
}

function locationIsOpen(hours: any[]): boolean {
  // Use Intl to get the real Kyiv wall-clock time (UTC+2 winter / UTC+3 summer)
  const kyivStr = new Date().toLocaleString('en-US', { timeZone: 'Europe/Kiev' })
  const kyiv = new Date(kyivStr)
  const day = kyiv.getDay()
  const t = kyiv.getHours().toString().padStart(2, '0') + ':' + kyiv.getMinutes().toString().padStart(2, '0')
  const wh = hours.find((h: any) => h.dayOfWeek === day)
  if (!wh || wh.isClosed) return false
  return t >= wh.openTime && t < wh.closeTime
}

export default async function orderRoutes(app: FastifyInstance) {

  async function requireAuth(req: any, reply: any) {
    try { await req.jwtVerify() } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }
  }

  app.post('/', { preHandler: requireAuth }, async (req: any, reply: any) => {
    const schema = z.object({
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
    })
    const result = schema.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ success: false, error: 'Invalid request' })

    const { locationId, items, paymentMethod, comment, pointsUsed } = result.data

    const location = await prisma.location.findUnique({
      where: { id: locationId, isActive: true },
      include: { workingHours: true },
    })
    if (!location) return reply.status(404).send({ success: false, error: 'Location not found' })
    if (!location.allowOrders) return reply.status(400).send({ success: false, error: 'Orders not allowed here' })
    if (!locationIsOpen(location.workingHours)) return reply.status(400).send({ success: false, error: 'Closed now' })

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return reply.status(404).send({ success: false, error: 'User not found' })

    let total = 0
    const orderItems: any[] = []

    for (const item of items) {
      if (item.productId) {
        const p = await prisma.product.findUnique({ where: { id: item.productId } })
        if (!p || !p.isAvailable || p.locationId !== locationId) {
          return reply.status(400).send({ success: false, error: 'Product unavailable: ' + (p?.name || item.productId) })
        }
        const price = Number(p.price)
        total += price * item.quantity
        orderItems.push({ productId: p.id, name: p.name, price, quantity: item.quantity, modifiers: item.modifiers || null })
      } else if (item.bundleId) {
        const b = await prisma.bundle.findUnique({ where: { id: item.bundleId } })
        if (!b || !b.isAvailable || b.locationId !== locationId) {
          return reply.status(400).send({ success: false, error: 'Bundle unavailable' })
        }
        const price = Number(b.price)
        total += price * item.quantity
        orderItems.push({ bundleId: b.id, name: b.name, price, quantity: item.quantity, modifiers: null })
      }
    }

    let discount = 0
    if (pointsUsed > 0) {
      if (user.points < pointsUsed) return reply.status(400).send({ success: false, error: 'Not enough points' })
      const maxDiscount = Math.floor(total * 0.2)
      discount = Math.min(pointsUsed, maxDiscount)
    }
    const finalTotal = Math.max(0, total - discount)
    const qrCode = 'PU-' + crypto.randomBytes(6).toString('hex').toUpperCase()

    const order = await prisma.order.create({
      data: {
        userId: user.id, locationId,
        status: 'PENDING', total: finalTotal, discount,
        paymentMethod, comment: comment || null, pointsUsed, qrCode,
        items: { create: orderItems },
      },
      include: { items: true },
    })

    if (pointsUsed > 0) {
      await prisma.user.update({ where: { id: user.id }, data: { points: { decrement: discount } } })
      await prisma.pointsTransaction.create({ data: {
        userId: user.id, amount: -discount, type: 'REDEEM',
        description: 'Points for order #' + order.id,
        idempotencyKey: 'redeem-order-' + order.id,
      }})
    }

    await redisCache.del('menu:' + location.slug)

    const itemLines = orderItems.map((i: any) => '- ' + i.name + ' x' + i.quantity + ' = ' + (i.price * i.quantity) + ' uah').join('\n')
    const msg = [
      'New order #' + order.id, location.name, itemLines,
      discount > 0 ? 'Discount: -' + discount + ' uah' : '',
      'Total: ' + finalTotal + ' uah',
      paymentMethod === 'cash' ? 'Cash' : 'Card',
      comment ? 'Note: ' + comment : '',
      'QR: ' + qrCode,
    ].filter(Boolean).join('\n')
    await tgSend(OWNER_ID, msg)

    // Notify the customer with their QR code
    const userMsg = 'Order #' + order.id + ' received!\n'
      + '\u2615 ' + location.name + '\n'
      + 'Total: ' + finalTotal + ' uah\n'
      + '\nYour QR code:\n`' + qrCode + '`\n'
      + 'Show to the barista when picking up.'
    await tgSend(String(user.telegramId), userMsg)

    return reply.send({ success: true, orderId: order.id, qrCode, total: finalTotal, status: 'PENDING' })
  })

  app.get('/', { preHandler: requireAuth }, async (req: any, reply: any) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: true, location: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'desc' }, take: 20,
    })
    return reply.send({ success: true, orders })
  })

  app.get('/:id', { preHandler: requireAuth }, async (req: any, reply: any) => {
    const id = parseInt((req.params as any).id)
    const order = await prisma.order.findFirst({
      where: { id, userId: req.user.id },
      include: { items: true, location: { select: { name: true, slug: true } } },
    })
    if (!order) return reply.status(404).send({ success: false, error: 'Not found' })
    return reply.send({ success: true, order })
  })

  app.delete('/:id', { preHandler: requireAuth }, async (req: any, reply: any) => {
    const id = parseInt((req.params as any).id)
    const order = await prisma.order.findFirst({ where: { id, userId: req.user.id } })
    if (!order) return reply.status(404).send({ success: false, error: 'Not found' })
    if (!['PENDING', 'PAYMENT_PENDING'].includes(order.status)) {
      return reply.status(400).send({ success: false, error: 'Cannot cancel' })
    }
    await prisma.order.update({ where: { id }, data: { status: 'CANCELLED' } })
    return reply.send({ success: true })
  })

  app.patch('/:id/status', { preHandler: requireAuth }, async (req: any, reply: any) => {
    if (!['BARISTA', 'ADMIN', 'OWNER'].includes(req.user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden' })
    }
    const id = parseInt((req.params as any).id)
    const parsed = z.object({
      status: z.enum(['ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']),
    }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: 'Invalid status' })

    const order = await prisma.order.findUnique({ where: { id }, include: { user: true } })
    if (!order) return reply.status(404).send({ success: false, error: 'Not found' })

    await prisma.order.update({ where: { id }, data: { status: parsed.data.status } })

    if (parsed.data.status === 'COMPLETED') {
      const pts = calcEarnedPoints(Number(order.total), order.user.points)
      if (pts > 0) {
        const key = 'order-complete-' + id
        const exists = await prisma.pointsTransaction.findUnique({ where: { idempotencyKey: key } })
        if (!exists) {
          await prisma.pointsTransaction.create({ data: {
            userId: order.userId, amount: pts, type: 'ORDER',
            description: 'Points for order #' + id, idempotencyKey: key,
          }})
          await prisma.user.update({
            where: { id: order.userId },
            data: { points: { increment: pts }, monthlyOrders: { increment: 1 } },
          })
          await tgSend(String(order.user.telegramId), 'You got ' + pts + ' points for order #' + id + '!')
        }
      }
    }

    const statusMsg: Record<string, string> = {
      ACCEPTED:  'Order #' + id + ' accepted! Preparing your coffee',
      READY:     'Order #' + id + ' is ready! Pick it up',
      CANCELLED: 'Order #' + id + ' cancelled.',
    }
    if (statusMsg[parsed.data.status]) {
      await tgSend(String(order.user.telegramId), statusMsg[parsed.data.status])
    }

    return reply.send({ success: true, status: parsed.data.status })
  })
}
