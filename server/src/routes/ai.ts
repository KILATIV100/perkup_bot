import { FastifyInstance } from 'fastify'
import { redisCache } from '../lib/redis'
import { prisma } from '../lib/prisma'

const WEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || ''
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const BROVARY_LAT = '50.5167'
const BROVARY_LON = '30.7833'
const CLAUDE_MODEL = 'claude-3-5-haiku-20241022'
const CACHE_12H = 43200
const CACHE_1H = 3600

interface ClaudeResponse {
  content?: Array<{ text?: string }>
}

interface WeatherMain {
  temp?: number
}

interface WeatherCondition {
  description?: string
}

interface WeatherResponse {
  main?: WeatherMain
  weather?: WeatherCondition[]
}

async function callClaude(prompt: string, maxTokens = 300): Promise<string> {
  if (!ANTHROPIC_API_KEY) return ''
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json() as ClaudeResponse
    return (data.content?.[0]?.text || '').trim()
  } catch (err) {
    console.error('Claude API error:', err)
    return ''
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export default async function aiRoutes(app: FastifyInstance) {
  async function optionalAuth(req: any, _reply: any) {
    try { await req.jwtVerify() } catch { /* guest */ }
  }

  async function requireAuth(req: any, reply: any) {
    try { await req.jwtVerify() } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }
  }

  // GET /api/ai/weather-menu
  app.get('/weather-menu', async (_req, reply) => {
    const cacheKey = 'ai:weather-menu:' + todayKey()
    const cached = await redisCache.get(cacheKey)
    if (cached) return reply.send({ success: true, ...JSON.parse(cached) })

    let temp = 0
    let description = 'clear'
    try {
      const wRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${BROVARY_LAT}&lon=${BROVARY_LON}&appid=${WEATHER_API_KEY}&units=metric&lang=en`
      )
      const wData = await wRes.json() as WeatherResponse
      temp = Math.round(wData.main?.temp ?? 0)
      description = wData.weather?.[0]?.description || 'clear'
    } catch (err) {
      console.error('Weather fetch error:', err)
    }

    const weatherText = `${temp}\u00B0C, ${description}`
    const prompt = `You are a friendly barista at PerkUp coffee shop in Brovary, Ukraine.
Current weather: ${weatherText}.
Recommend ONE coffee or drink from: espresso, cappuccino, latte, flat white, americano, cold brew, hot chocolate, matcha latte.
Write 2-3 sentences in English. Be warm and weather-aware. No lists, no bullet points.`

    const recommendation = await callClaude(prompt, 200)

    const payload = { temp, description, recommendation }
    await redisCache.set(cacheKey, JSON.stringify(payload), 'EX', CACHE_1H)
    return reply.send({ success: true, ...payload })
  })

  // GET /api/ai/card-of-day
  app.get('/card-of-day', async (_req, reply) => {
    const cacheKey = 'ai:card-of-day:' + todayKey()
    const cached = await redisCache.get(cacheKey)
    if (cached) return reply.send({ success: true, ...JSON.parse(cached) })

    const prompt = `You are a poetic barista. Write a short poetic description (3-4 sentences) of today's "Coffee of the Day" at PerkUp cafe in Brovary.
Make it atmospheric, warm, and inspiring. Start with the drink name on the first line (2-4 words, creative), then write the poetic description.
Write in English. No hashtags, no markdown.`

    const text = await callClaude(prompt, 280)
    const lines = text.split('\n').filter(l => l.trim().length > 0)
    const drinkName = (lines[0] || 'Morning Blend').replace(/[*_#]/g, '').trim()
    const descriptionText = lines.slice(1).join(' ').trim() || text

    const payload = { drinkName, description: descriptionText }
    await redisCache.set(cacheKey, JSON.stringify(payload), 'EX', CACHE_12H)
    return reply.send({ success: true, ...payload })
  })

  // GET /api/ai/coffee-fact
  app.get('/coffee-fact', async (_req, reply) => {
    const cacheKey = 'ai:coffee-fact:' + todayKey()
    const cached = await redisCache.get(cacheKey)
    if (cached) return reply.send({ success: true, ...JSON.parse(cached) })

    const prompt = `Share ONE interesting, surprising or little-known fact about coffee.
Write 1-2 sentences in English. Make it engaging and educational. No lists, no bullet points, no markdown.`

    const fact = await callClaude(prompt, 150)
    const payload = { fact }
    await redisCache.set(cacheKey, JSON.stringify(payload), 'EX', CACHE_12H)
    return reply.send({ success: true, ...payload })
  })

  // POST /api/ai/mood-menu
  app.post('/mood-menu', { preHandler: requireAuth }, async (req: any, reply) => {
    const body = req.body as { mood?: string; locationSlug?: string }
    const { mood, locationSlug } = body

    if (!mood || typeof mood !== 'string') {
      return reply.status(400).send({ success: false, error: 'mood required' })
    }

    let menuItems: string[] = []
    if (locationSlug && typeof locationSlug === 'string') {
      const products = await prisma.product.findMany({
        where: { location: { slug: locationSlug }, isAvailable: true },
        select: { name: true },
        take: 25,
      })
      menuItems = products.map(p => p.name)
    }

    const menuStr = menuItems.length > 0
      ? 'Available drinks: ' + menuItems.join(', ')
      : 'Available drinks: espresso, cappuccino, latte, flat white, americano, cold brew, hot chocolate'

    const prompt = `You are a friendly PerkUp barista. A customer says they feel: "${mood}".
${menuStr}.
Recommend ONE specific drink from the list and explain in 2 sentences why it suits their mood.
Write in English. Be warm and personal. No lists.`

    const recommendation = await callClaude(prompt, 200)
    const matched = menuItems.find(name =>
      recommendation.toLowerCase().includes(name.toLowerCase())
    )

    return reply.send({ success: true, recommendation, matchedDrink: matched || null })
  })

  // GET /api/ai/daily-challenge
  app.get('/daily-challenge', { preHandler: optionalAuth }, async (req: any, reply) => {
    const dateKey = todayKey()
    const cacheKey = 'ai:challenge:' + dateKey

    let challenge = await redisCache.get(cacheKey)
    if (!challenge) {
      const prompt = `Create ONE fun daily coffee challenge for PerkUp cafe customers.
Examples: "Try your coffee without sugar today", "Ask the barista for their secret favorite drink", "Take a mindful sip and describe the flavor".
Write ONE sentence in English. Be fun, positive, and achievable. No lists.`
      challenge = await callClaude(prompt, 100)
      if (!challenge) challenge = 'Try your coffee at a slower pace today and enjoy every sip!'
      await redisCache.set(cacheKey, challenge, 'EX', CACHE_12H)
    }

    const POINTS_FOR_CHALLENGE = 5
    let claimed = false

    if (req.user?.id) {
      const claimKey = 'ai:challenge-claimed:' + dateKey + ':' + req.user.id
      claimed = !!(await redisCache.get(claimKey))
    }

    return reply.send({ success: true, challenge, points: POINTS_FOR_CHALLENGE, claimed, dateKey })
  })

  // POST /api/ai/daily-challenge/claim
  app.post('/daily-challenge/claim', { preHandler: requireAuth }, async (req: any, reply) => {
    const dateKey = todayKey()
    const userId: number = req.user.id
    const claimKey = 'ai:challenge-claimed:' + dateKey + ':' + userId
    const idempotencyKey = 'challenge-' + dateKey + '-' + userId

    const alreadyClaimed = await redisCache.get(claimKey)
    if (alreadyClaimed) {
      return reply.status(400).send({ success: false, error: 'Already claimed today' })
    }

    const existing = await prisma.pointsTransaction.findUnique({ where: { idempotencyKey } })
    if (existing) {
      await redisCache.set(claimKey, '1', 'EX', 86400)
      return reply.status(400).send({ success: false, error: 'Already claimed today' })
    }

    const POINTS = 5
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { points: { increment: POINTS } } }),
      prisma.pointsTransaction.create({
        data: {
          userId,
          amount: POINTS,
          type: 'BONUS',
          description: 'Daily challenge ' + dateKey,
          idempotencyKey,
        },
      }),
    ])

    await redisCache.set(claimKey, '1', 'EX', 86400)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { points: true } })

    return reply.send({ success: true, pointsAdded: POINTS, totalPoints: user?.points ?? 0 })
  })
}
