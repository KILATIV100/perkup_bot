import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { prisma } from './lib/prisma'
import { redis } from './lib/redis'
import authRoutes from './routes/auth'
import locationRoutes from './routes/locations'
import menuRoutes from './routes/menu'
import orderRoutes from './routes/orders'
import shiftsRoutes from './routes/shifts'
import loyaltyRoutes from './routes/loyalty'
import adminRoutes from './routes/admin'
import mediaRoutes from './routes/media'
import reviewRoutes from './routes/reviews'
import notificationsRoutes from './routes/notifications'
import healthRoutes from './routes/health'
import posterWebhookRoutes from './routes/webhooks/poster'
import { schedulePosterSync, startPosterSyncWorker } from './workers/posterSync'
import { scheduleReminderJobs, startReminderWorker } from './workers/reminders'
import { syncAllLocations } from './services/poster'

const app = Fastify({ logger: { level: 'info' }, ignoreTrailingSlash: true, ignoreDuplicateSlashes: true })

async function bootstrap() {
  await app.register(cors, {
    origin: [process.env.CLIENT_URL || 'https://perkup.com.ua', process.env.ADMIN_URL || 'https://admin.perkup.com.ua', 'http://localhost:5173', 'http://localhost:3001'],
    credentials: true,
  })
  await app.register(jwt, { secret: process.env.JWT_SECRET || 'fallback-secret', sign: { expiresIn: '7d' } })
  await app.register(rateLimit, { global: true, max: 100, timeWindow: '1 minute', redis, keyGenerator: (req) => (req as any).user?.id?.toString() || req.ip })
  await app.register(healthRoutes,        { prefix: '/health' })
  await app.register(authRoutes,          { prefix: '/api/auth' })
  await app.register(locationRoutes,      { prefix: '/api/locations' })
  await app.register(menuRoutes,          { prefix: '/api/menu' })
  await app.register(orderRoutes,         { prefix: '/api/orders' })
  await app.register(shiftsRoutes,        { prefix: '/api/shifts' })
  await app.register(loyaltyRoutes,       { prefix: '/api/loyalty' })
  await app.register(adminRoutes,         { prefix: '/api/admin' })
  await app.register(mediaRoutes,         { prefix: '/api/media' })
  await app.register(reviewRoutes,        { prefix: '/api/reviews' })
  await app.register(notificationsRoutes, { prefix: '/api/notifications' })
  await app.register(posterWebhookRoutes, { prefix: '/webhooks/poster' })
  app.setErrorHandler((error, _req, reply) => {
    if (error.statusCode === 429) return reply.status(429).send({ success: false, error: 'Too many requests' })
    if (error.statusCode && error.statusCode < 500) return reply.status(error.statusCode).send({ success: false, error: error.message })
    console.error(error)
    return reply.status(500).send({ success: false, error: 'Internal server error' })
  })
  const port = parseInt(process.env.PORT || '3000')
  await app.listen({ port, host: '0.0.0.0' })
  console.log('PerkUp Server running on port ' + port)
  try { await prisma.$connect(); console.log('PostgreSQL connected') } catch (err) { console.error('PostgreSQL error:', (err as Error).message) }
  try { await redis.ping(); console.log('Redis connected') } catch (err) { console.error('Redis error:', (err as Error).message) }
  try {
    startPosterSyncWorker()
    await schedulePosterSync()
    console.log('Poster sync worker started')
    setTimeout(async () => {
      console.log('[Poster] Running initial sync...')
      await syncAllLocations()
      console.log('[Poster] Initial sync done')
    }, 8000)
  } catch (err) { console.error('Poster sync error:', (err as Error).message) }

  try {
    startReminderWorker()
    await scheduleReminderJobs()
    console.log('Reminder worker started')
  } catch (err) { console.error('Reminder worker error:', (err as Error).message) }
}

process.on('SIGTERM', async () => { await app.close(); await prisma.$disconnect(); process.exit(0) })
process.on('SIGINT',  async () => { await app.close(); await prisma.$disconnect(); process.exit(0) })
bootstrap().catch((err) => { console.error('Fatal:', err); process.exit(1) })
