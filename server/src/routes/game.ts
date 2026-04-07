import { FastifyInstance } from 'fastify'
import { redis } from '../lib/redis'
import { prisma } from '../lib/prisma'

const LEADERBOARD_KEY = 'game:coffee-jump:leaderboard'
const MAX_SCORE = 999999 // анти-чит ліміт
const DAILY_PLAYS_LIMIT = 50
const POINTS_THRESHOLDS = [
  { score: 500, points: 5 },
  { score: 1000, points: 10 },
  { score: 2500, points: 20 },
  { score: 5000, points: 50 },
]

export default async function gameRoutes(app: FastifyInstance) {
  async function requireAuth(req: any, reply: any) {
    try { await req.jwtVerify() } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }
  }

  // POST /api/game/coffee-jump/score — зберегти результат
  app.post('/coffee-jump/score', { preHandler: requireAuth }, async (req: any, reply) => {
    const { score } = req.body as { score?: number }
    const userId: number = req.user.id

    if (!score || typeof score !== 'number' || score < 0 || score > MAX_SCORE || !Number.isInteger(score)) {
      return reply.status(400).send({ success: false, error: 'Invalid score' })
    }

    // Rate limit: daily plays
    const dayKey = new Date().toISOString().slice(0, 10)
    const playsKey = `game:plays:${userId}:${dayKey}`
    const plays = await redis.incr(playsKey)
    if (plays === 1) await redis.expire(playsKey, 86400)
    if (plays > DAILY_PLAYS_LIMIT) {
      return reply.status(429).send({ success: false, error: 'Daily play limit reached' })
    }

    // Get user info for leaderboard
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, points: true },
    })
    if (!user) return reply.status(404).send({ success: false, error: 'User not found' })

    // Get previous best
    const prevBest = await redis.zscore(LEADERBOARD_KEY, String(userId))
    const isNewRecord = !prevBest || score > Number(prevBest)

    if (isNewRecord) {
      // Update leaderboard (sorted set)
      await redis.zadd(LEADERBOARD_KEY, score, String(userId))
      // Store user name mapping
      await redis.hset('game:coffee-jump:names', String(userId), user.firstName || 'Гість')
    }

    // Calculate earned points
    let earnedPoints = 0
    for (const t of POINTS_THRESHOLDS) {
      const claimKey = `game:points:${userId}:${t.score}`
      if (score >= t.score) {
        const alreadyClaimed = await redis.get(claimKey)
        if (!alreadyClaimed) {
          earnedPoints += t.points
          await redis.set(claimKey, '1')
        }
      }
    }

    // Award points
    if (earnedPoints > 0) {
      const idempotencyKey = `game-coffee-jump-${userId}-${score}-${Date.now()}`
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
    }

    // Get rank
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
    // Top 20 players
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
    const dayKey = new Date().toISOString().slice(0, 10)
    const playsToday = Number(await redis.get(`game:plays:${userId}:${dayKey}`)) || 0

    // Check which point thresholds are unlocked
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
