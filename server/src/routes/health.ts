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
}
