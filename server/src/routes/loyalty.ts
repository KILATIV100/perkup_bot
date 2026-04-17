import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import crypto from 'crypto'

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

function getLevel(points: number): string {
  if (points >= 3000) return 'Platinum'
  if (points >= 1000) return 'Gold'
  if (points >= 300) return 'Silver'
  return 'Bronze'
}

function getNextLevel(points: number): { name: string; required: number } | null {
  if (points < 300) return { name: 'Silver', required: 300 }
  if (points < 1000) return { name: 'Gold', required: 1000 }
  if (points < 3000) return { name: 'Platinum', required: 3000 }
  return null
}

const WHEEL_PRIZES = [
  { id: 'points20',  label: '+20 балів',       emoji: '⭐', type: 'points',   value: 20,  weight: 20 },
  { id: 'points10',  label: '+10 балів',       emoji: '⭐', type: 'points',   value: 10,  weight: 17 },
  { id: 'upgrade',   label: 'Апгрейд напою',   emoji: '☕', type: 'voucher',  value: 100, weight: 12 },
  { id: 'discount',  label: '-10% знижка',      emoji: '🔥', type: 'discount', value: 10, weight: 10 },
  { id: 'sweet',     label: 'Солодощі',         emoji: '🍰', type: 'voucher',  value: 100, weight: 8  },
  { id: 'coffee',    label: 'Кава в подарунок', emoji: '☕', type: 'voucher',  value: 100, weight: 5  },
  { id: 'sticker',   label: 'Стікер PerkUp',    emoji: '🎁', type: 'physical', value: 0, weight: 3  },
  { id: 'nothing',   label: 'Не пощастило',     emoji: '😔', type: 'nothing',  value: 0,  weight: 25 },
]

function spinWheel(): typeof WHEEL_PRIZES[0] {
  const total = WHEEL_PRIZES.reduce((s, p) => s + p.weight, 0)
  let rand = Math.random() * total
  for (const prize of WHEEL_PRIZES) {
    rand -= prize.weight
    if (rand <= 0) return prize
  }
  return WHEEL_PRIZES[WHEEL_PRIZES.length - 1]
}

export { getLevelMultiplier, getLevel }

export default async function loyaltyRoutes(app: FastifyInstance) {

  async function requireAuth(req: any, reply: any) {
    try { await req.jwtVerify() } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }
  }

  async function requireStaff(req: any, reply: any) {
    try { await req.jwtVerify() } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }
    if (!['BARISTA', 'ADMIN', 'OWNER'].includes(req.user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden' })
    }
  }

  app.get('/status', { preHandler: requireAuth }, async (req: any, reply: any) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return reply.status(404).send({ success: false, error: 'Not found' })

    const points = user.points
    const level = getLevel(points)
    const multiplier = getLevelMultiplier(points)
    const nextLevel = getNextLevel(points)

    const completedOrders = await prisma.order.count({
      where: { userId: user.id, status: 'COMPLETED' },
    })
    const spinsEarned = Math.floor(completedOrders / 5)
    const spinsUsed = await prisma.spinResult.count({ where: { userId: user.id } })
    const spinsAvailable = Math.max(0, spinsEarned - spinsUsed)

    const transactions = await prisma.pointsTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const vouchers = await prisma.prizeVoucher.findMany({
      where: { userId: user.id, isUsed: false, expiresAt: { gt: new Date() } },
    })

    return reply.send({
      success: true, points, level, multiplier, nextLevel,
      spinsAvailable, completedOrders, transactions, vouchers,
    })
  })

  app.post('/spin', { preHandler: requireAuth }, async (req: any, reply: any) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return reply.status(404).send({ success: false, error: 'Not found' })

    const completedOrders = await prisma.order.count({
      where: { userId: user.id, status: 'COMPLETED' },
    })
    const spinsEarned = Math.floor(completedOrders / 5)
    const spinsUsed = await prisma.spinResult.count({ where: { userId: user.id } })

    if (spinsEarned - spinsUsed <= 0) {
      return reply.status(400).send({ success: false, error: 'No spins available' })
    }

    const prize = spinWheel()
    const prizeIndex = WHEEL_PRIZES.findIndex(p => p.id === prize.id)

    await prisma.spinResult.create({
      data: { userId: user.id, prizeId: prize.id, prizeLabel: prize.label },
    })

    let voucherCode: string | null = null

    if (prize.type === 'points') {
      const multiplier = getLevelMultiplier(user.points)
      const bonus = Math.round(prize.value * multiplier)
      await prisma.user.update({ where: { id: user.id }, data: { points: { increment: bonus } } })
      await prisma.pointsTransaction.create({
        data: {
          userId: user.id, amount: bonus, type: 'BONUS',
          description: 'Spin: ' + prize.id,
          idempotencyKey: 'spin-' + user.id + '-' + Date.now(),
        },
      })
      await tgSend(String(user.telegramId), '⭐ Нараховано ' + bonus + ' балів за спін!')

    } else if (prize.type !== 'nothing') {
      voucherCode = crypto.randomBytes(3).toString('hex').toUpperCase()
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000)
      await prisma.prizeVoucher.create({
        data: {
          userId: user.id, code: voucherCode,
          prizeId: prize.id, prizeLabel: prize.label,
          prizeType: prize.type, prizeValue: prize.value,
          expiresAt, isUsed: false,
        },
      })
      await tgSend(String(user.telegramId), '🎉 Приз: ' + prize.label + '\nКод: ' + voucherCode + '\nДійсний 7 днів.')
    }

    return reply.send({
      success: true,
      prizeIndex,
      prize,
      voucherCode,
      prizes: WHEEL_PRIZES,
    })
  })

  app.get('/prizes', async (_req: any, reply: any) => {
    return reply.send({ success: true, prizes: WHEEL_PRIZES })
  })

  // ─── VOUCHER LOOKUP (for barista/admin) ─────────────────────────
  app.get('/voucher/:code', { preHandler: requireStaff }, async (req: any, reply: any) => {
    const code = (req.params as any).code.toUpperCase()
    const voucher = await prisma.prizeVoucher.findUnique({ where: { code } })
    if (!voucher) return reply.status(404).send({ success: false, error: 'Ваучер не знайдено' })
    if (voucher.isUsed) return reply.status(400).send({ success: false, error: 'Ваучер вже використано', voucher })
    if (voucher.expiresAt < new Date()) return reply.status(400).send({ success: false, error: 'Ваучер прострочено', voucher })
    const user = await prisma.user.findUnique({ where: { id: voucher.userId }, select: { firstName: true, lastName: true, phone: true, points: true } })
    return reply.send({ success: true, voucher, user })
  })

  app.post('/redeem/:code', { preHandler: requireAuth }, async (req: any, reply: any) => {
    if (!['BARISTA', 'ADMIN', 'OWNER'].includes(req.user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden' })
    }
    const code = (req.params as any).code.toUpperCase()
    const voucher = await prisma.prizeVoucher.findUnique({ where: { code } })
    if (!voucher) return reply.status(404).send({ success: false, error: 'Not found' })
    if (voucher.isUsed) return reply.status(400).send({ success: false, error: 'Already used' })
    if (voucher.expiresAt < new Date()) return reply.status(400).send({ success: false, error: 'Expired' })

    await prisma.prizeVoucher.update({ where: { code }, data: { isUsed: true, usedAt: new Date() } })

    const user = await prisma.user.findUnique({ where: { id: voucher.userId } })
    if (user) await tgSend(String(user.telegramId), '✅ Приз "' + voucher.prizeLabel + '" активовано!')

    return reply.send({ success: true, prize: voucher.prizeLabel, type: voucher.prizeType })
  })
}
