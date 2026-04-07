import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'

export default async function radioRoutes(app: FastifyInstance) {
  async function requireAuth(req: any, reply: any) {
    try { await req.jwtVerify() } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }
  }

  async function requireAdmin(req: any, reply: any) {
    try { await req.jwtVerify() } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }
    if (!['ADMIN', 'OWNER'].includes(req.user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden' })
    }
  }

  // GET /api/radio/playlist
  app.get('/playlist', async (_req, reply) => {
    const tracks = await prisma.radioTrack.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
    })
    return reply.send({ success: true, tracks })
  })

  // GET /api/radio/now - synchronized radio by server time
  app.get('/now', async (_req, reply) => {
    const tracks = await prisma.radioTrack.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
    })

    if (tracks.length === 0) {
      return reply.send({ success: true, currentTrack: null, position: 0, serverTime: Date.now() })
    }

    const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0)
    if (totalDuration === 0) {
      return reply.send({ success: true, currentTrack: tracks[0], position: 0, serverTime: Date.now() })
    }

    const nowSec = Math.floor(Date.now() / 1000)
    const dayStart = Math.floor(nowSec / 86400) * 86400
    const elapsed = (nowSec - dayStart) % totalDuration

    let accumulated = 0
    let currentTrack = tracks[0]
    let positionInTrack = 0

    for (const track of tracks) {
      if (elapsed < accumulated + track.duration) {
        currentTrack = track
        positionInTrack = elapsed - accumulated
        break
      }
      accumulated += track.duration
    }

    return reply.send({
      success: true,
      currentTrack,
      position: positionInTrack,
      serverTime: Date.now(),
    })
  })

  // POST /api/radio/add-track
  app.post('/add-track', { preHandler: requireAdmin }, async (req: any, reply) => {
    const body = req.body as {
      fileId?: string
      title?: string
      artist?: string
      duration?: number
      genre?: string
      url?: string
    }

    if (!body.fileId || !body.title || !body.url) {
      return reply.status(400).send({ success: false, error: 'fileId, title and url are required' })
    }

    const agg = await prisma.radioTrack.aggregate({ _max: { position: true } })
    const position = (agg._max.position ?? -1) + 1

    const track = await prisma.radioTrack.create({
      data: {
        fileId: body.fileId,
        title: body.title,
        artist: body.artist || 'PerkUp Radio',
        duration: body.duration || 180,
        genre: body.genre || 'lofi',
        url: body.url,
        position,
        isActive: true,
      },
    })

    return reply.status(201).send({ success: true, track })
  })

  // POST /api/radio/user-genre
  app.post('/user-genre', { preHandler: requireAuth }, async (req: any, reply) => {
    const body = req.body as { genre?: string }
    if (!body.genre || typeof body.genre !== 'string') {
      return reply.status(400).send({ success: false, error: 'genre required' })
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { radioGenre: body.genre },
    })

    return reply.send({ success: true, genre: body.genre })
  })
}
