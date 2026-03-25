import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { prisma } from './lib/prisma'
import { redis } from './lib/redis'

// Routes
import authRoutes from './routes/auth'
import locationRoutes from './routes/locations'
import menuRoutes from './routes/menu'
import orderRoutes from './routes/orders'
import loyaltyRoutes from './routes/loyalty'
import adminRoutes from './routes/admin'
import mediaRoutes from './routes/media'
import healthRoutes from './routes/health'
import posterWebhookRoutes from './routes/webhooks/poster'

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
  ignoreTrailingSlash: true,
  ignoreDuplicateSlashes: true,
})

async function bootstrap() {
  // ─── Plugins ──────────────────────────────────────────────────
  await app.register(cors, {
    origin: [
      process.env.CLIENT_URL || 'https://perkup.com.ua',
      process.env.ADMIN_URL || 'https://admin.perkup.com.ua',
      'http://localhost:5173',
      'http://localhost:3001',
    ],
    credentials: true,
  })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
    sign: { expiresIn: '7d' },
  })

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (req) => {
      // Rate limit per user (from JWT) or IP
      return (req as any).user?.id?.toString() || req.ip
    },
  })

  // ─── Routes ───────────────────────────────────────────────────
  await app.register(healthRoutes, { prefix: '/health' })
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(locationRoutes, { prefix: '/api/locations' })
  await app.register(menuRoutes, { prefix: '/api/menu' })
  await app.register(orderRoutes, { prefix: '/api/orders' })
  await app.register(loyaltyRoutes, { prefix: '/api/loyalty' })
  await app.register(adminRoutes, { prefix: '/api/admin' })
  await app.register(mediaRoutes, { prefix: '/api/media' })
  await app.register(posterWebhookRoutes, { prefix: '/webhooks/poster' })

  // ─── Global error handler ─────────────────────────────────────
  app.setErrorHandler((error, req, reply) => {
    app.log.error(error)

    if (error.statusCode === 429) {
      return reply.status(429).send({
        success: false,
        error: 'Забагато запитів. Спробуй через хвилину.',
      })
    }

    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message,
      })
    }

    return reply.status(500).send({
      success: false,
      error: process.env.NODE_ENV === 'production'
        ? 'Внутрішня помилка сервера'
        : error.message,
    })
  })

  // ─── Start ────────────────────────────────────────────────────
  const port = parseInt(process.env.PORT || '3000')
  const host = '0.0.0.0'

  await app.listen({ port, host })
  app.log.info(`🚀 PerkUp Server running on port ${port}`)

  // Verify DB connection
  await prisma.$connect()
  app.log.info('✅ PostgreSQL connected')

  // Verify Redis connection
  await redis.ping()
  app.log.info('✅ Redis connected')
}

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM']
signals.forEach((signal) => {
  process.on(signal, async () => {
    app.log.info(`Received ${signal}, shutting down...`)
    await app.close()
    await prisma.$disconnect()
    redis.disconnect()
    process.exit(0)
  })
})

bootstrap().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
