import { FastifyInstance } from 'fastify'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { redis } from '../lib/redis'
import { prisma } from '../lib/prisma'

const LEADERBOARD_KEY = 'game:coffee-jump:leaderboard'
const MAX_SCORE = 999999
const DAILY_PLAYS_LIMIT = 50
const POINTS_THRESHOLDS = [
  { score: 500, points: 5 },
  { score: 1000, points: 10 },
  { score: 2500, points: 20 },
  { score: 5000, points: 50 },
]
const DAILY_GENERIC_GAME_LIMIT = 30
const GAME_POINT_CAP_PER_DAY = 60

const VALID_GAME_TYPES = [
  'TIC_TAC_TOE', 'MEMORY', 'QUIZ', 'WORD_PUZZLE',
  'PERKIE_CATCH', 'BARISTA_RUSH', 'MEMORY_COFFEE', 'PERKIE_JUMP'
] as const

const gameFinishSchema = z.object({
  type: z.enum(VALID_GAME_TYPES),
  score: z.number().min(0).max(100000),
})

// Cooldown per game type (hours)
const GAME_COOLDOWN: Record<string, number> = {
  QUIZ: 24,
  TIC_TAC_TOE: 4,
  MEMORY: 4,
  WORD_PUZZLE: 4,
  DEFAULT: 4,
}

function getKyivDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(date)
}

function calcEarnedPoints(type: string, score: number): number {
  switch (type) {
    case 'TIC_TAC_TOE': return score >= 1 ? 5 : score >= 0.5 ? 2 : 0
    case 'MEMORY': return score <= 20 ? 5 : score <= 35 ? 4 : score <= 50 ? 3 : score <= 75 ? 2 : 1
    case 'QUIZ': return score >= 1 ? 3 : 0
    case 'WORD_PUZZLE': return Math.min(Math.floor(score), 5)
    default:
      if (score >= 15) return 10
      if (score >= 5) return 5
      return 2
  }
}

export default async function gameRoutes(app: FastifyInstance) {
  async function requireAuth(req: any, reply: any) {
    try { await req.jwtVerify() } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }
  }

  // GET /api/game/status
  app.get('/status', { preHandler: requireAuth }, async (req: any, reply) => {
    const userId: number = req.user.id
    const dayKey = getKyivDayKey()
    const todayKey = `game:daily:${userId}:${dayKey}`
    const pointsKey = `game:daily-points:${userId}:${dayKey}`

    const [playsTotalRaw, pointsEarnedRaw] = await Promise.all([
      redis.hget(todayKey, 'total'),
      redis.get(pointsKey),
    ])

    // Cooldown check per game type
    const canPlay: Record<string, boolean> = {}
    for (const type of VALID_GAME_TYPES) {
      const lastKey = `game:last:${userId}:${type}`
      const lastPlayed = await redis.get(lastKey)
      if (!lastPlayed) {
        canPlay[type] = true
      } else if (type === 'QUIZ') {
        // Quiz: once per calendar day
        canPlay[type] = lastPlayed < dayKey
      } else {
        const cooldownHours = GAME_COOLDOWN[type] || GAME_COOLDOWN.DEFAULT
        const hoursSince = (Date.now() - Number(lastPlayed)) / 3600000
        canPlay[type] = hoursSince >= cooldownHours
      }
    }

    return reply.send({
      success: true,
      date: dayKey,
      playsToday: Number(playsTotalRaw || 0),
      playsLimit: DAILY_GENERIC_GAME_LIMIT,
      pointsEarnedToday: Number(pointsEarnedRaw || 0),
      pointsCapToday: GAME_POINT_CAP_PER_DAY,
      canPlay,
      daily: {
        current: Number(pointsEarnedRaw || 0),
        max: GAME_POINT_CAP_PER_DAY,
      },
      pending: 0,
      bonus: 0,
    })
  })

  // POST /api/game/finish
  app.post('/finish', { preHandler: requireAuth }, async (req: any, reply) => {
    const userId: number = req.user.id
    const parsed = gameFinishSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ success: false, error: 'Invalid game type or score' })
    }

    const { type, score } = parsed.data
    const dayKey = getKyivDayKey()
    const todayKey = `game:daily:${userId}:${dayKey}`
    const pointsKey = `game:daily-points:${userId}:${dayKey}`

    // Cooldown check
    const lastKey = `game:last:${userId}:${type}`
    const lastPlayed = await redis.get(lastKey)
    if (lastPlayed) {
      if (type === 'QUIZ') {
        if (lastPlayed >= dayKey) {
          return reply.status(429).send({ success: false, error: 'COOLDOWN', hoursLeft: 24 })
        }
      } else {
        const cooldownHours = GAME_COOLDOWN[type] || GAME_COOLDOWN.DEFAULT
        const hoursSince = (Date.now() - Number(lastPlayed)) / 3600000
        if (hoursSince < cooldownHours) {
          return reply.status(429).send({
            success: false,
            error: 'COOLDOWN',
            hoursLeft: Math.ceil(cooldownHours - hoursSince),
          })
        }
      }
    }

    const playsTotal = await redis.hincrby(todayKey, 'total', 1)
    if (playsTotal === 1) await redis.expire(todayKey, 86400)

    if (playsTotal > DAILY_GENERIC_GAME_LIMIT) {
      return reply.status(429).send({ success: false, error: 'Daily game limit reached' })
    }

    const rawPoints = calcEarnedPoints(type, score)
    const pointsEarnedToday = Number(await redis.get(pointsKey) || 0)
    const availableBudget = Math.max(0, GAME_POINT_CAP_PER_DAY - pointsEarnedToday)
    const earnedPoints = Math.min(rawPoints, availableBudget)

    if (earnedPoints > 0) {
      const playNo = await redis.hincrby(todayKey, `type:${type}`, 1)
      const idempotencyKey = `game-finish-${userId}-${dayKey}-${type}-${playNo}`
      try {
        await prisma.$transaction([
          prisma.user.update({ where: { id: userId }, data: { points: { increment: earnedPoints } } }),
          prisma.pointsTransaction.create({
            data: {
              userId,
              amount: earnedPoints,
              type: 'GAME',
              description: `Game ${type} score ${score}`,
              idempotencyKey,
            },
          }),
        ])
        await redis.set(pointsKey, String(pointsEarnedToday + earnedPoints), 'EX', 86400)
      } catch (err: any) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err
        }
      }
    }

    // Save last played timestamp
    if (type === 'QUIZ') {
      await redis.set(lastKey, dayKey, 'EX', 86400 * 2)
    } else {
      const cooldownSecs = (GAME_COOLDOWN[type] || 4) * 3600
      await redis.set(lastKey, String(Date.now()), 'EX', cooldownSecs + 3600)
    }

    return reply.send({
      success: true,
      type,
      score,
      pointsWon: earnedPoints,
      earnedPoints,
      playsToday: playsTotal,
      playsLimit: DAILY_GENERIC_GAME_LIMIT,
    })
  })

  // POST /api/game/coffee-jump/score
  app.post('/coffee-jump/score', { preHandler: requireAuth }, async (req: any, reply) => {
    const { score } = req.body as { score?: number }
    const userId: number = req.user.id

    if (typeof score !== 'number' || score < 0 || score > MAX_SCORE || !Number.isInteger(score)) {
      return reply.status(400).send({ success: false, error: 'Invalid score' })
    }

    const dayKey = getKyivDayKey()
    const playsKey = `game:plays:${userId}:${dayKey}`
    const plays = await redis.incr(playsKey)
    if (plays === 1) await redis.expire(playsKey, 86400)
    if (plays > DAILY_PLAYS_LIMIT) {
      return reply.status(429).send({ success: false, error: 'Daily play limit reached' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, points: true },
    })
    if (!user) return reply.status(404).send({ success: false, error: 'User not found' })

    const prevBest = await redis.zscore(LEADERBOARD_KEY, String(userId))
    const isNewRecord = !prevBest || score > Number(prevBest)

    if (isNewRecord) {
      await redis.zadd(LEADERBOARD_KEY, score, String(userId))
      await redis.hset('game:coffee-jump:names', String(userId), user.firstName || 'Гість')
    }

    let earnedPoints = 0
    const unlockedThresholds: number[] = []
    for (const t of POINTS_THRESHOLDS) {
      const claimKey = `game:points:${userId}:${t.score}`
      if (score >= t.score) {
        const alreadyClaimed = await redis.get(claimKey)
        if (!alreadyClaimed) {
          earnedPoints += t.points
          unlockedThresholds.push(t.score)
        }
      }
    }

    if (earnedPoints > 0) {
      const rewardsKey = unlockedThresholds.sort((a, b) => a - b).join('-')
      const idempotencyKey = `game-coffee-jump-${userId}-${rewardsKey}`
      try {
        await prisma.$transaction([
          prisma.user.update({ where: { id: userId }, data: { points: { increment: earnedPoints } } }),
          prisma.pointsTransaction.create({
            data: {
              userId,
              amount: earnedPoints,
              type: 'BONUS',
              description: `Coffee Jump: ${score} очків`,
              idempotencyKey,
            },
          }),
        ])
      } catch (err: any) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          earnedPoints = 0
        } else {
          throw err
        }
      }
      if (earnedPoints > 0) {
        for (const threshold of unlockedThresholds) {
          await redis.set(`game:points:${userId}:${threshold}`, '1')
        }
      }
    }

    const rank = await redis.zrevrank(LEADERBOARD_KEY, String(userId))

    return reply.send({
      success: true,
      isNewRecord,
      bestScore: isNewRecord ? score : Number(prevBest),
      rank: rank !== null ? rank + 1 : null,
      earnedPoints,
      totalPlaysToday: plays,
    })
  })

  // GET /api/game/coffee-jump/leaderboard
  app.get('/coffee-jump/leaderboard', async (_req, reply) => {
    const top = await redis.zrevrange(LEADERBOARD_KEY, 0, 19, 'WITHSCORES')
    const entries: { rank: number; userId: number; name: string; score: number }[] = []
    for (let i = 0; i < top.length; i += 2) {
      const uId = Number(top[i])
      const sc = Number(top[i + 1])
      const name = await redis.hget('game:coffee-jump:names', String(uId)) || 'Гість'
      entries.push({ rank: entries.length + 1, userId: uId, name, score: sc })
    }
    return reply.send({ success: true, leaderboard: entries })
  })

  // GET /api/game/coffee-jump/my-stats
  app.get('/coffee-jump/my-stats', { preHandler: requireAuth }, async (req: any, reply) => {
    const userId: number = req.user.id
    const bestScore = await redis.zscore(LEADERBOARD_KEY, String(userId))
    const rank = await redis.zrevrank(LEADERBOARD_KEY, String(userId))
    const dayKey = getKyivDayKey()
    const playsToday = Number(await redis.get(`game:plays:${userId}:${dayKey}`)) || 0
    const unlockedRewards: { score: number; points: number; claimed: boolean }[] = []
    for (const t of POINTS_THRESHOLDS) {
      const claimed = !!(await redis.get(`game:points:${userId}:${t.score}`))
      unlockedRewards.push({ ...t, claimed })
    }
    return reply.send({
      success: true,
      bestScore: bestScore ? Number(bestScore) : 0,
      rank: rank !== null ? rank + 1 : null,
      playsToday,
      playsLimit: DAILY_PLAYS_LIMIT,
      rewards: unlockedRewards,
    })
  })
}
