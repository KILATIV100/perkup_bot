import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'

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
        nodeEnv: process.env.NODE_ENV || 'not set',
      },
      tables: results,
    })
  })
}
