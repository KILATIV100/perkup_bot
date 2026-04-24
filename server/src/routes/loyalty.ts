import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import crypto from 'crypto'
import { getLevel, getLevelMultiplier, getNextLevel } from '../lib/loyalty'

const BOT = process.env.BOT_TOKEN || ''
const REFERRAL_BONUS_FOR_FRIEND = 20
const REFERRAL_BONUS_FOR_REFERRER = 20

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

const WHEEL_PRIZES = [
  { id: 'points20',  label: '+20 балів',        emoji: '⭐', type: 'points',   value: 20,  weight: 20 },
  { id: 'points10',  label: '+10 балів',        emoji: '⭐', type: 'points',   value: 10,  weight: 17 },
  { id: 'upgrade',   label: 'Апгрейд напою',    emoji: '☕', type: 'voucher',  value: 100, weight: 12 },
  { id: 'discount',  label: '-10% знижка',      emoji: '🔥', type: 'discount', value: 10,  weight: 10 },
  { id: 'sweet',     label: 'Солодощі',         emoji: '🍰', type: 'voucher',  value: 100, weight: 8  },
  { id: 'coffee',    label: 'Кава в подарунок', emoji: '☕', type: 'voucher',  value: 100, weight: 5  },
  { id: 'sticker',   label: 'Стікер PerkUp',    emoji: '🎁', type: 'physical', value: 0,   weight: 3  },
  { id: 'nothing',   label: 'Не пощастило',     emoji: '😔', type: 'nothing',  value: 0,   weight: 25 },
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
    const boughtSpinCredits = Math.floor((user.monthlyOrders || 0) / 5)
    const spinsEarned = Math.floor(completedOrders / 5) + boughtSpinCredits
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

  app.get('/referral', { preHandler: requireAuth }, async (req: any, reply: any) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true },
    })
    if (!user) return reply.status(404).send({ success: false, error: 'Not found' })

    const invitedCount = await prisma.user.count({
      where: { referredById: user.id },
    })

    const referralCode = `ref_${user.id}`
    const referralLink = `https://t.me/${process.env.BOT_USERNAME || 'perkupbot'}?start=${referralCode}`

    return reply.send({
      success: true,
      referralCode,
      referralLink,
      invitedCount,
      bonusForFriend: REFERRAL_BONUS_FOR_FRIEND,
      bonusForReferrer: REFERRAL_BONUS_FOR_REFERRER,
    })
  })

  app.post('/spin', { preHandler: requireAuth }, async (req: any, reply: any) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return reply.status(404).send({ success: false, error: 'Not found' })

    const completedOrders = await prisma.order.count({
      where: { userId: user.id, status: 'COMPLETED' },
    })
    const boughtSpinCredits = Math.floor((user.monthlyOrders || 0) / 5)
    const spinsEarned = Math.floor(completedOrders / 5) + boughtSpinCredits
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
      await tgSend(String(user.telegramId), '🎁 Приз: ' + prize.label + '\nКод: ' + voucherCode + '\nДійсний 7 днів.')
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

  // ─── VOUCHER LOOKUP (for barista/admin) ──────────────────────────────────────
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

  // ─── BUY SPINS ───────────────────────────────────────────────────────────────
  const SPIN_PACKAGES = [
    { id: 'spin_1', spins: 1, cost: 50,  label: '1 спін'  },
    { id: 'spin_3', spins: 3, cost: 120, label: '3 спіни' },
    { id: 'spin_5', spins: 5, cost: 175, label: '5 спінів' },
  ]

  app.get('/spin-packages', async (_req, reply) => {
    return reply.send({ success: true, packages: SPIN_PACKAGES })
  })

  app.post('/buy-spins', { preHandler: requireAuth }, async (req: any, reply: any) => {
    const { packageId } = req.body as { packageId: string }
    const pkg = SPIN_PACKAGES.find(p => p.id === packageId)
    if (!pkg) return reply.status(400).send({ success: false, error: 'Невірний пакет' })

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })
    if (!user) return reply.status(404).send({ success: false, error: 'Not found' })
    if (user.points < pkg.cost) {
      return reply.status(400).send({ success: false, error: `Недостатньо балів. Потрібно ${pkg.cost}, є ${user.points}` })
    }

    const key = `buy_spins:${user.id}:${Date.now()}`
    await prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: user.id },
        data: { points: { decrement: pkg.cost } }
      })
      await tx.pointsTransaction.create({
        data: {
          userId: user.id,
          amount: -pkg.cost,
          type: 'SPIN',
          description: `Куплено ${pkg.label} за бали`,
          idempotencyKey: key,
        }
      })
      await tx.user.update({
        where: { id: user.id },
        data: { monthlyOrders: { increment: pkg.spins * 5 } }
      })
    })

    const updated = await prisma.user.findUnique({ where: { id: user.id } })
    await tgSend(String(user.telegramId), `🎰 Куплено ${pkg.label}! Списано ${pkg.cost} балів.`)

    return reply.send({
      success: true,
      message: `${pkg.label} додано!`,
      pointsSpent: pkg.cost,
      newBalance: updated?.points || 0,
    })
  })
}
