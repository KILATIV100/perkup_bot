import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import crypto from 'crypto'
import { Prisma, OrderStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'
import { getLocationProfile } from '../lib/locationProfile'
import { normalizePhoneOrThrow } from '../lib/phone'
import { awardCompletedOrderLoyalty } from '../lib/orderRewards'
import { createPosterIncomingOrder } from '../services/poster'

const OWNER_ID = process.env.OWNER_TELEGRAM_ID || ''
const BOT = process.env.BOT_TOKEN || ''

async function tgSend(chatId: string, text: string) {
  if (!BOT || !chatId) return
  try {
    await fetch('https://api.telegram.org/bot' + BOT + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch (e) { console.error('tgSend error:', e) }
}

function locationIsOpen(hours: any[]): boolean {
  if (!hours || !Array.isArray(hours)) return true
  const kyivStr = new Date().toLocaleString('en-US', { timeZone: 'Europe/Kyiv' })
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
      locationId: z.number().int().positive(),
      items: z.array(z.object({
        productId: z.number().int().positive().optional(),
        bundleId: z.number().int().positive().optional(),
        quantity: z.number().min(1).max(20),
        modifiers: z.record(z.string()).optional(),
      })).min(1),
      customerPhone: z.string().min(10).max(20).optional(),
      comment: z.string().max(300).optional(),
      pointsUsed: z.number().min(0).default(0),
      pointsToRedeem: z.number().min(0).optional(),
    })

    const result = schema.safeParse(req.body)
    if (!result.success) return reply.status(400).send({ success: false, error: 'Invalid request' })

    const rawData = result.data
    const pointsUsed = rawData.pointsToRedeem ?? rawData.pointsUsed
    const { locationId, items, customerPhone, comment } = rawData

    const location = await prisma.location.findUnique({
      where: { id: locationId, isActive: true },
      include: { workingHours: true },
    })
    if (!location) return reply.status(404).send({ success: false, error: 'Location not found' })
    const locationProfile = getLocationProfile(location)
    if (!locationProfile.remoteOrderingEnabled) {
      return reply.status(400).send({
        success: false,
        error: locationProfile.format === 'SELF_SERVICE'
          ? 'This location accepts orders only on-site'
          : 'Orders are not available for this location right now',
      })
    }
    if (!locationIsOpen((location as any).workingHours || [])) {
      return reply.status(400).send({ success: false, error: 'Closed now' })
    }

    const activeShift = await prisma.shift.findFirst({
      where: { locationId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    })

    const user: any = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return reply.status(404).send({ success: false, error: 'User not found' })

    let normalizedPhone: string | null = null
    if (location.hasPoster) {
      const requestedPhone = customerPhone || user.phone
      if (!requestedPhone) {
        return reply.status(400).send({ success: false, error: 'Phone number is required for Poster preorder' })
      }
      try {
        normalizedPhone = normalizePhoneOrThrow(requestedPhone)
      } catch (error) {
        return reply.status(400).send({ success: false, error: (error as Error).message })
      }
    }

    let total = 0
    const orderItems: any[] = []
    const posterProducts: Array<{ product_id: number; count: number }> = []
    const modifierComments: string[] = []

    for (const item of items) {
      if (item.productId) {
        const p = await prisma.product.findUnique({ where: { id: item.productId } })
        if (!p || !p.isAvailable || p.locationId !== locationId) {
          return reply.status(400).send({ success: false, error: 'Product unavailable: ' + (p?.name || item.productId) })
        }
        const price = Number(p.price)
        total += price * item.quantity
        orderItems.push({ productId: p.id, name: p.name, price: new Prisma.Decimal(price), quantity: item.quantity, modifiers: (item.modifiers && Object.keys(item.modifiers).length > 0) ? item.modifiers : null })
        if (location.hasPoster) {
          if (!p.posterProductId || Number.isNaN(Number(p.posterProductId))) {
            return reply.status(400).send({ success: false, error: `Product ${p.name} is not linked to Poster` })
          }
          posterProducts.push({ product_id: Number(p.posterProductId), count: item.quantity })
          if (item.modifiers && Object.keys(item.modifiers).length > 0) {
            const mods = Object.entries(item.modifiers).map(([key, value]) => `${key}: ${value}`).join(', ')
            modifierComments.push(`${p.name} â ${mods}`)
          }
        }
      } else if (item.bundleId) {
        if (location.hasPoster) {
          return reply.status(400).send({ success: false, error: 'Bundles are not supported for Poster preorder yet' })
        }
        const b = await prisma.bundle.findUnique({ where: { id: item.bundleId } })
        if (!b || !b.isAvailable || b.locationId !== locationId) {
          return reply.status(400).send({ success: false, error: 'Bundle unavailable' })
        }
        const price = Number(b.price)
        total += price * item.quantity
        orderItems.push({ bundleId: b.id, name: b.name, price: new Prisma.Decimal(price), quantity: item.quantity, modifiers: null })
      }
    }

    let discount = 0
    if (pointsUsed > 0) {
      if (location.hasPoster) {
        return reply.status(400).send({ success: false, error: 'Bonus redemption is not available for Poster preorders yet. Bonuses will be credited after payment at the cashier.' })
      }
      if (user.points < pointsUsed) return reply.status(400).send({ success: false, error: 'Not enough points' })
      const maxDiscount = Math.floor(total * 0.2)
      discount = Math.min(pointsUsed, maxDiscount)
    }

    const finalTotal = Math.max(0, total - discount)
    const qrCode = 'PU-' + crypto.randomBytes(6).toString('hex').toUpperCase()

    const order = await prisma.$transaction(async (tx) => {
      if (discount > 0) {
        // Atomic conditional decrement: only succeeds if user still has enough points.
        // Prevents race when two concurrent orders try to spend the same balance.
        const res = await tx.user.updateMany({
          where: { id: user.id, points: { gte: discount } },
          data: { points: { decrement: discount } },
        })
        if (res.count === 0) {
          throw new Error('INSUFFICIENT_POINTS')
        }
      }
      const created = await tx.order.create({
        data: {
          userId: user.id,
          locationId,
          shiftId: activeShift?.id,
          status: activeShift ? 'PENDING' : 'UNASSIGNED',
          total: new Prisma.Decimal(finalTotal),
          discount: new Prisma.Decimal(discount),
          paymentMethod: 'cashier',
          comment: comment || null,
          pointsUsed,
          qrCode,
          items: { create: orderItems },
        },
        include: { items: true },
      })
      if (discount > 0) {
        await tx.pointsTransaction.create({ data: {
          userId: user.id, amount: -discount, type: 'REDEEM',
          description: 'Points for order #' + created.id,
          idempotencyKey: 'redeem-order-' + created.id,
        }})
      }
      return created
    }).catch((err: Error) => {
      if (err.message === 'INSUFFICIENT_POINTS') return null
      throw err
    })

    if (!order) {
      return reply.status(400).send({ success: false, error: 'Not enough points' })
    }

    let finalStatus: OrderStatus = order.status
    let posterOrderId: number | null = null

    if (location.hasPoster) {
      try {
        const posterComment = [
          `PerkUp order #${order.id}`,
          `QR: ${qrCode}`,
          comment || '',
          modifierComments.length > 0 ? `Modifiers: ${modifierComments.join(' | ')}` : '',
        ].filter(Boolean).join('\n')

        const posterOrder = await createPosterIncomingOrder({
          location: {
            id: location.id,
            name: location.name,
            slug: location.slug,
            posterToken: location.posterToken,
            posterSpotId: location.posterSpotId,
            hasPoster: location.hasPoster,
          },
          firstName: user.firstName,
          lastName: user.lastName,
          phone: normalizedPhone!,
          comment: posterComment,
          products: posterProducts,
        })

        posterOrderId = parseInt(posterOrder.incomingOrderId, 10)
        finalStatus = OrderStatus.SENT_TO_POS

        await prisma.order.update({
          where: { id: order.id },
          data: { posterOrderId, status: finalStatus },
        })
      } catch (error) {
        if (discount > 0) {
          await prisma.user.update({ where: { id: user.id }, data: { points: { increment: discount } } })
          await prisma.pointsTransaction.deleteMany({ where: { idempotencyKey: 'redeem-order-' + order.id } })
        }
        await prisma.orderItem.deleteMany({ where: { orderId: order.id } })
        await prisma.order.delete({ where: { id: order.id } })
        await tgSend(OWNER_ID, `Poster sync failed for order #${order.id} at ${location.name}: ${(error as Error).message}`)
        return reply.status(502).send({ success: false, error: `Failed to send order to Poster: ${(error as Error).message}` })
      }
    }

    await redis.del('menu:' + location.slug)

    const itemLines = orderItems.map((i: any) => '- ' + i.name + ' x' + i.quantity + ' = ' + (Number(i.price) * i.quantity) + ' uah').join('\n')
    const msg = [
      'New order #' + order.id, location.name, itemLines,
      discount > 0 ? 'Discount: -' + discount + ' uah' : '',
      'Total: ' + finalTotal + ' uah',
      'Payment: at cashier / POS',
      posterOrderId ? 'Poster incoming order: ' + posterOrderId : '',
      activeShift ? 'Shift: #' + activeShift.id : 'Shift: missing',
      comment ? 'Note: ' + comment : '',
      'QR: ' + qrCode,
    ].filter(Boolean).join('\n')

    await tgSend(OWNER_ID, msg)

    if (user.telegramId) {
      const userMsg = [
        `✅ Замовлення #${order.id} створено!`,
        '',
        `📍 ${location.name}`,
        posterOrderId ? `✔️ Передзамовлення надіслано до каси` : '',
        `💳 Сума до оплати: ${finalTotal} грн`,
        '',
        comment ? `💬 Коментар: ${comment}` : '',
      ].filter(Boolean).join('\n')
      await tgSend(String(user.telegramId), userMsg)
    }

    return reply.send({
      success: true,
      orderId: order.id,
      qrCode,
      total: finalTotal,
      status: finalStatus,
      paymentFlow: locationProfile.paymentFlow,
      posSystem: locationProfile.posSystem,
      posterOrderId,
    })
  })

  app.get('/', { preHandler: requireAuth }, async (req: any, reply: any) => {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      include: { items: true, location: { select: { name: true, slug: true, googlePlaceId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return reply.send({ success: true, orders })
  })

  app.get('/:id', { preHandler: requireAuth }, async (req: any, reply: any) => {
    const id = Number(req.params.id)
    const order = await prisma.order.findFirst({
      where: { id, userId: req.user.id },
      include: { items: true, location: { select: { name: true, slug: true, googlePlaceId: true } } },
    })
    if (!order) return reply.status(404).send({ success: false, error: 'Not found' })
    return reply.send({ success: true, order })
  })

  app.delete('/:id', { preHandler: requireAuth }, async (req: any, reply: any) => {
    const id = Number(req.params.id)
    const isStaff = ['BARISTA', 'ADMIN', 'OWNER'].includes(req.user.role)

    // Staff can cancel any order, users only their own
    const order = await prisma.order.findFirst({
      where: isStaff ? { id } : { id, userId: req.user.id }
    })
    if (!order) return reply.status(404).send({ success: false, error: 'Not found' })

    // Staff can cancel active orders, users only pending ones
    const allowedStatuses = isStaff
      ? ['PENDING', 'PAYMENT_PENDING', 'UNASSIGNED', 'SENT_TO_POS', 'ACCEPTED', 'PREPARING', 'READY']
      : ['PENDING', 'PAYMENT_PENDING', 'UNASSIGNED']

    if (!allowedStatuses.includes(order.status)) {
      return reply.status(400).send({ success: false, error: 'Cannot cancel' })
    }
    await prisma.order.update({ where: { id }, data: { status: 'CANCELLED' } })

    // Notify user about cancellation
    const cancelledUser = await prisma.user.findUnique({ where: { id: order.userId } })
    if (cancelledUser?.telegramId) {
      await tgSend(String(cancelledUser.telegramId),
        `❌ Замовлення #${id} скасовано.\nЯкщо є питання — звертайтесь до нас.`
      )
    }

    if (order.discount && Number(order.discount) > 0) {
      const refundKey = 'cancel-refund-order-' + id
      const exists = await prisma.pointsTransaction.findUnique({ where: { idempotencyKey: refundKey } })
      if (!exists) {
        await prisma.pointsTransaction.create({ data: {
          userId: order.userId,
          amount: Number(order.discount),
          type: 'BONUS',
          description: 'Refund for cancelled order #' + id,
          idempotencyKey: refundKey,
        }})
        await prisma.user.update({
          where: { id: order.userId },
          data: { points: { increment: Number(order.discount) } },
        })
      }
    }
    return reply.send({ success: true })
  })

  app.patch('/:id/status', { preHandler: requireAuth }, async (req: any, reply: any) => {
    if (!['BARISTA', 'ADMIN', 'OWNER'].includes(req.user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden' })
    }
    const id = Number(req.params.id)
    const parsed = z.object({
      status: z.enum(['ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']),
    }).safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: 'Invalid status' })

    const order = await prisma.order.findUnique({
      where: { id },
      include: { user: true, location: { select: { name: true, slug: true } } },
    })
    if (!order) return reply.status(404).send({ success: false, error: 'Not found' })

    await prisma.order.update({ where: { id }, data: { status: parsed.data.status } })

    if (parsed.data.status === 'COMPLETED') {
      const pts = await prisma.$transaction((tx) => awardCompletedOrderLoyalty(tx, {
        orderId: id,
        userId: order.userId,
        total: Number(order.total),
        userPoints: order.user.points,
      }))
  
      if (pts > 0) {
        // Build receipt
        const updatedUser = await prisma.user.findUnique({ where: { id: order.userId } })
        const orderItems = await prisma.orderItem.findMany({
          where: { orderId: id },
          include: { product: { select: { name: true } }, bundle: { select: { name: true } } }
        })

        const items = orderItems.map((item: any) => ({
          name: item.product?.name || item.bundle?.name || 'Товар',
          quantity: item.quantity,
          price: Math.round(Number(item.price || 0)),
        }))

        const userPoints = updatedUser?.points || 0
        const level = userPoints >= 3000 ? 'Platinum' : userPoints >= 1000 ? 'Gold' : userPoints >= 300 ? 'Silver' : 'Bronze'

        // Build and send receipt
        const now = new Date().toLocaleString('uk-UA', {
          timeZone: 'Europe/Kyiv',
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
        const locationName = order.location?.name || 'PerkUp'
        const total = Math.round(Number(order.total))
        const sep = '─'.repeat(28)
        const levelEmoji = ({ Bronze: '🥉', Silver: '🥈', Gold: '🥇', Platinum: '💎' } as any)[level] || '☕'

        let itemLines = ''
        for (const item of items) {
          const lineTotal = String(item.price * item.quantity)
          const name = item.name.length > 20 ? item.name.slice(0, 19) + '...' : item.name
          const dots = '.'.repeat(Math.max(1, 24 - name.length - lineTotal.length))
          itemLines += '  ' + name + dots + lineTotal + ' grn'
          if (item.quantity > 1) itemLines += ' (' + item.quantity + ' x ' + item.price + ')'
          itemLines += '\n'
        }

        const lines2 = [
          '\u{1f9fe} *\u0427\u0435\u043a #' + id + '*',
          sep,
          '\u{1f4cd} ' + locationName,
          '\u{1f4c5} ' + now,
          sep,
          itemLines.trim(),
          sep,
          '\u{1f4b3} *\u0420\u0430\u0437\u043e\u043c:  ' + total + ' \u0433\u0440\u043d*',
          sep,
          levelEmoji + ' *+' + pts + ' \u0431\u0430\u043b\u0456\u0432 \u043d\u0430\u0440\u0430\u0445\u043e\u0432\u0430\u043d\u043e*',
          '   \u0411\u0430\u043b\u0430\u043d\u0441: ' + userPoints + ' \u0431\u0430\u043b\u0456\u0432',
          sep,
          '_\u0414\u044f\u043a\u0443\u0454\u043c\u043e! \u041f\u0440\u0438\u0445\u043e\u0434\u044c\u0442\u0435 \u0437\u043d\u043e\u0432\u0443 \u2615_',
        ]
        const receiptText = lines2.join('\n')

        await tgSend(String(order.user.telegramId), receiptText)
      }
    }

    const statusMsgUk: Record<string, string> = {
      ACCEPTED: `☕ Замовлення #${id} прийнято! Готуємо твою каву...`,
      READY: `🔔 Замовлення #${id} готове! Підходь забирати.`,
      CANCELLED: `❌ Замовлення #${id} скасовано.`,
    }
    if (statusMsgUk[parsed.data.status]) {
      await tgSend(String(order.user.telegramId), statusMsgUk[parsed.data.status])
    }

    return reply.send({ success: true, status: parsed.data.status })
  })
}
