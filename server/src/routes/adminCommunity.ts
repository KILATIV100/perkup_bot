import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

export default async function adminCommunityRoutes(app: FastifyInstance) {
  async function adminOnly(req: any, reply: any) {
    try { await req.jwtVerify() } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }
    if (!['ADMIN', 'OWNER'].includes(req.user.role)) {
      return reply.status(403).send({ success: false, error: 'Admin only' })
    }
  }

  app.get('/messages', { preHandler: adminOnly }, async (req: any, reply) => {
    const query = z.object({
      channel: z.enum(['GENERAL', 'BOARD_GAMES', 'MOVIE_NIGHTS']).optional(),
      status: z.enum(['VISIBLE', 'HIDDEN', 'DELETED_BY_USER', 'DELETED_BY_ADMIN']).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(100),
    }).safeParse(req.query)

    const where: any = {}
    if (query.success && query.data.channel) where.channel = query.data.channel
    if (query.success && query.data.status) where.status = query.data.status

    const messages = await prisma.communityMessage.findMany({
      where,
      include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take: query.success ? query.data.limit : 100,
    })

    return reply.send({
      success: true,
      items: messages,
    })
  })

  app.patch('/messages/:id/hide', { preHandler: adminOnly }, async (req: any, reply) => {
    const id = String(req.params.id)
    const message = await prisma.communityMessage.findUnique({ where: { id } })
    if (!message) return reply.status(404).send({ success: false, error: 'Message not found' })

    await prisma.communityMessage.update({
      where: { id },
      data: { status: 'DELETED_BY_ADMIN' },
    })

    return reply.send({ success: true })
  })

  app.get('/board-games', { preHandler: adminOnly }, async (_req, reply) => {
    const games = await prisma.boardGame.findMany({ orderBy: { createdAt: 'desc' } })
    return reply.send({ success: true, games })
  })

  app.post('/board-games', { preHandler: adminOnly }, async (req: any, reply) => {
    const body = z.object({
      title: z.string().trim().min(1).max(100),
      description: z.string().trim().max(500).optional(),
      imageUrl: z.string().url().optional(),
      minPlayers: z.coerce.number().int().positive().optional(),
      maxPlayers: z.coerce.number().int().positive().optional(),
      avgDurationMin: z.coerce.number().int().positive().optional(),
      difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
      isAvailable: z.boolean().optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid payload' })

    const game = await prisma.boardGame.create({ data: body.data })
    return reply.send({ success: true, game })
  })

  app.patch('/board-games/:id', { preHandler: adminOnly }, async (req: any, reply) => {
    const id = String(req.params.id)
    const body = z.object({
      title: z.string().trim().min(1).max(100).optional(),
      description: z.string().trim().max(500).optional().nullable(),
      imageUrl: z.string().url().optional().nullable(),
      minPlayers: z.coerce.number().int().positive().optional().nullable(),
      maxPlayers: z.coerce.number().int().positive().optional().nullable(),
      avgDurationMin: z.coerce.number().int().positive().optional().nullable(),
      difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional().nullable(),
      isAvailable: z.boolean().optional(),
    }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid payload' })

    const game = await prisma.boardGame.update({ where: { id }, data: body.data as any })
    return reply.send({ success: true, game })
  })

  app.get('/meetups', { preHandler: adminOnly }, async (_req, reply) => {
    const meetups = await prisma.boardGameMeetup.findMany({
      include: {
        game: true,
        location: { select: { id: true, slug: true, name: true } },
        creator: { select: { id: true, firstName: true, lastName: true, username: true } },
        participants: { where: { status: 'JOINED' } },
      },
      orderBy: { startsAt: 'asc' },
    })
    return reply.send({ success: true, meetups })
  })

  app.post('/meetups/:id/cancel', { preHandler: adminOnly }, async (req: any, reply) => {
    const id = String(req.params.id)
    await prisma.boardGameMeetup.update({ where: { id }, data: { status: 'CANCELLED' } })
    return reply.send({ success: true })
  })

  app.get('/events', { preHandler: adminOnly }, async (_req, reply) => {
    const events = await prisma.communityEvent.findMany({
      include: {
        location: { select: { id: true, slug: true, name: true } },
        participants: true,
        movieOptions: { include: { votes: true } },
      },
      orderBy: { startsAt: 'asc' },
    })
    return reply.send({ success: true, events })
  })

  app.post('/events', { preHandler: adminOnly }, async (req: any, reply) => {
    const body = z.object({
      type: z.enum(['MOVIE_NIGHT', 'BOARD_GAME_NIGHT', 'MEETUP', 'OTHER']),
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().max(1000).optional(),
      imageUrl: z.string().url().optional(),
      locationId: z.coerce.number().int().positive().optional(),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime().optional(),
      capacity: z.coerce.number().int().positive().max(500).optional(),
      movieOptions: z.array(z.object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(500).optional(),
        posterUrl: z.string().url().optional(),
      })).optional(),
    }).safeParse(req.body)

    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid payload' })

    const startsAt = new Date(body.data.startsAt)
    const endsAt = body.data.endsAt ? new Date(body.data.endsAt) : undefined

    const created = await prisma.communityEvent.create({
      data: {
        type: body.data.type,
        title: body.data.title,
        description: body.data.description,
        imageUrl: body.data.imageUrl,
        locationId: body.data.locationId,
        startsAt,
        endsAt,
        capacity: body.data.capacity,
        status: 'PUBLISHED',
        createdById: req.user.id,
        movieOptions: body.data.movieOptions?.length
          ? {
            create: body.data.movieOptions.map((opt, idx) => ({
              title: opt.title,
              description: opt.description,
              posterUrl: opt.posterUrl,
              sortOrder: idx,
            })),
          }
          : undefined,
      },
      include: { movieOptions: true },
    })

    return reply.send({ success: true, event: created })
  })

  app.patch('/events/:id', { preHandler: adminOnly }, async (req: any, reply) => {
    const id = String(req.params.id)
    const body = z.object({
      title: z.string().trim().min(1).max(120).optional(),
      description: z.string().trim().max(1000).optional().nullable(),
      imageUrl: z.string().url().optional().nullable(),
      locationId: z.coerce.number().int().positive().optional().nullable(),
      startsAt: z.string().datetime().optional(),
      endsAt: z.string().datetime().optional().nullable(),
      capacity: z.coerce.number().int().positive().max(500).optional().nullable(),
      status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']).optional(),
    }).safeParse(req.body)

    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid payload' })

    const data: any = { ...body.data }
    if (body.data.startsAt) data.startsAt = new Date(body.data.startsAt)
    if (body.data.endsAt) data.endsAt = new Date(body.data.endsAt)

    const event = await prisma.communityEvent.update({ where: { id }, data })
    return reply.send({ success: true, event })
  })

  app.post('/events/:id/complete', { preHandler: adminOnly }, async (req: any, reply) => {
    const id = String(req.params.id)
    await prisma.communityEvent.update({ where: { id }, data: { status: 'COMPLETED' } })
    return reply.send({ success: true })
  })

  app.post('/events/:id/cancel', { preHandler: adminOnly }, async (req: any, reply) => {
    const id = String(req.params.id)
    await prisma.communityEvent.update({ where: { id }, data: { status: 'CANCELLED' } })
    return reply.send({ success: true })
  })
}
