import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { redis, redisCache } from '../lib/redis'

export default async function healthRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    let dbOk = false
    let redisOk = false

    try {
      await prisma.$queryRaw`SELECT 1`
      dbOk = true
    } catch {}

    try {
      await redis.ping()
      redisOk = true
    } catch {}

    const status = dbOk && redisOk ? 200 : 503

    return reply.status(status).send({
      status: status === 200 ? 'ok' : 'degraded',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      services: {
        database: dbOk ? 'ok' : 'error',
        redis: redisOk ? 'ok' : 'error',
      },
    })
  })

  // Diagnostic endpoint: test actual Prisma model queries
  app.get('/diag', async (req, reply) => {
    const results: Record<string, string> = {}

    try {
      const count = await prisma.location.count()
      results.locations = `ok (${count})`
    } catch (err: any) {
      results.locations = `error: ${err.message}`
    }

    try {
      const count = await prisma.user.count()
      results.users = `ok (${count})`
    } catch (err: any) {
      results.users = `error: ${err.message}`
    }

    try {
      const count = await prisma.product.count()
      results.products = `ok (${count})`
    } catch (err: any) {
      results.products = `error: ${err.message}`
    }

    try {
      const count = await prisma.workingHours.count()
      results.workingHours = `ok (${count})`
    } catch (err: any) {
      results.workingHours = `error: ${err.message}`
    }

    try {
      await redis.ping()
      results.redis = 'ok'
    } catch (err: any) {
      results.redis = `error: ${err.message}`
    }

    const hasError = Object.values(results).some(v => v.startsWith('error'))

    return reply.status(hasError ? 503 : 200).send({
      status: hasError ? 'schema_mismatch' : 'ok',
      timestamp: new Date().toISOString(),
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        hasRedisUrl: !!process.env.REDIS_URL,
        hasBotToken: !!process.env.BOT_TOKEN,
        hasJwtSecret: !!process.env.JWT_SECRET,
        hasClientUrl: process.env.CLIENT_URL || '(not set, default: perkup.com.ua)',
        nodeEnv: process.env.NODE_ENV || 'not set',
      },
      tables: results,
    })
  })

  // Test endpoint: simulate what the client does (locations + menu)
  app.get('/test-flow', async (req, reply) => {
    const results: Record<string, any> = {}

    // 1. Test locations endpoint
    try {
      const locations = await prisma.location.findMany({
        where: { isActive: true },
        select: { id: true, slug: true, name: true },
        orderBy: { id: 'asc' },
      })
      results.locations = { ok: true, count: locations.length, slugs: locations.map(l => l.slug) }
    } catch (err: any) {
      results.locations = { ok: false, error: err.message }
    }

    // 2. Test menu for first location
    try {
      const firstLoc = await prisma.location.findFirst({ where: { isActive: true } })
      if (firstLoc) {
        const products = await prisma.product.findMany({
          where: { locationId: firstLoc.id, isAvailable: true },
          take: 3,
          select: { id: true, name: true, price: true, category: true },
        })
        results.menu = { ok: true, locationSlug: firstLoc.slug, sampleProducts: products.length, sample: products }
      } else {
        results.menu = { ok: false, error: 'No active location' }
      }
    } catch (err: any) {
      results.menu = { ok: false, error: err.message }
    }

    // 3. Test Redis cache (both instances)
    try {
      await redis.set('health-test', 'ok', 'EX', 10)
      const val = await redis.get('health-test')
      results.redisBullMQ = { ok: val === 'ok' }
    } catch (err: any) {
      results.redisBullMQ = { ok: false, error: err.message }
    }
    try {
      await redisCache.set('health-test-cache', 'ok', 'EX', 10)
      const val = await redisCache.get('health-test-cache')
      results.redisCache = { ok: val === 'ok' }
    } catch (err: any) {
      results.redisCache = { ok: false, error: err.message }
    }

    // 4. Test BOT_TOKEN is valid format
    const botToken = process.env.BOT_TOKEN || ''
    results.botToken = {
      present: !!botToken,
      format: /^\d+:[A-Za-z0-9_-]+$/.test(botToken) ? 'valid' : 'invalid',
      length: botToken.length,
    }

    return reply.send({ success: true, timestamp: new Date().toISOString(), results })
  })
}
