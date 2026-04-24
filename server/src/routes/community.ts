import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { redis } from '../lib/redis'

const chatQuerySchema = z.object({
  channel: z.enum(['GENERAL', 'BOARD_GAMES', 'MOVIE_NIGHTS']).default('GENERAL'),
  after: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

const postMessageSchema = z.object({
  channel: z.enum(['GENERAL', 'BOARD_GAMES', 'MOVIE_NIGHTS']),
  text: z.string().trim().min(1).max(500),
  replyToId: z.string().cuid().optional(),
})

const meetupCreateSchema = z.object({
  gameId: z.string().cuid().optional(),
  locationId: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  startsAt: z.string().datetime(),
  maxPlayers: z.coerce.number().int().min(2).max(12),
})

const eventsQuerySchema = z.object({
  type: z.enum(['MOVIE_NIGHT', 'BOARD_GAME_NIGHT', 'MEETUP', 'OTHER']).optional(),
  locationId: z.coerce.number().int().positive().optional(),
  upcoming: z.coerce.boolean().optional(),
})

function displayName(user: { firstName: string; lastName: string | null; username: string | null }) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return full || user.username || 'Гість'
}

async function rateLimitByUser(userId: number, action: string, limit: number, windowSec: number): Promise<boolean> {
  const key = `community:rl:${action}:${userId}`
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, windowSec)
  return count <= limit
}

export default async function communityRoutes(app: FastifyInstance) {
  async function requireAuth(req: any, reply: any) {
    try { await req.jwtVerify() } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized' })
    }
  }

  async function requireActiveUser(req: any, reply: any): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, isActive: true } })
    if (!user || !user.isActive) {
      reply.status(403).send({ success: false, error: 'User is blocked' })
      return false
    }
    return true
  }

  app.get('/chat/messages', async (req: any, reply) => {
    const parsed = chatQuerySchema.safeParse(req.query)
    if (!parsed.success) return reply.status(400).send({ success: false, error: 'Invalid query' })

    let currentUserId: number | null = null
    try {
      await req.jwtVerify()
      currentUserId = req.user.id
    } catch {}

    const where: any = { channel: parsed.data.channel, status: 'VISIBLE' }
    if (parsed.data.after) where.createdAt = { gt: new Date(parsed.data.after) }

    const messages = await prisma.communityMessage.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: parsed.data.limit,
    })

    return reply.send({
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        channel: m.channel,
        text: m.text,
        replyToId: m.replyToId,
        createdAt: m.createdAt,
        user: {
          id: m.user.id,
          displayName: displayName(m.user),
          avatarUrl: null,
        },
        isMine: currentUserId === m.userId,
      })),
    })
  })

  app.post('/chat/messages', { preHandler: requireAuth }, async (req: any, reply) => {
    if (!(await requireActiveUser(req, reply))) return
    const parsed = postMessageSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: 'Invalid payload' })

    const allowed = await rateLimitByUser(req.user.id, 'chat-message', 10, 60)
    if (!allowed) return reply.status(429).send({ success: false, error: 'Too many messages, try later' })

    if (parsed.data.replyToId) {
      const replyTo = await prisma.communityMessage.findUnique({ where: { id: parsed.data.replyToId } })
      if (!replyTo || replyTo.status !== 'VISIBLE') {
        return reply.status(400).send({ success: false, error: 'Reply message not found' })
      }
    }

    const created = await prisma.communityMessage.create({
      data: {
        userId: req.user.id,
        channel: parsed.data.channel,
        text: parsed.data.text,
        replyToId: parsed.data.replyToId,
      },
    })

    return reply.send({ success: true, message: created })
  })

  app.delete('/chat/messages/:id', { preHandler: requireAuth }, async (req: any, reply) => {
    const id = String(req.params.id || '')
    const msg = await prisma.communityMessage.findUnique({ where: { id } })
    if (!msg) return reply.status(404).send({ success: false, error: 'Message not found' })
    if (msg.userId !== req.user.id) return reply.status(403).send({ success: false, error: 'Forbidden' })

    await prisma.communityMessage.update({ where: { id }, data: { status: 'DELETED_BY_USER' } })
    return reply.send({ success: true })
  })

  app.get('/board-games', async (_req, reply) => {
    const games = await prisma.boardGame.findMany({
      where: { isAvailable: true },
      orderBy: { title: 'asc' },
    })
    return reply.send({ success: true, games })
  })

  app.get('/board-game-meetups', async (req: any, reply) => {
    const parsed = z.object({
      locationId: z.coerce.number().int().positive().optional(),
      date: z.string().optional(),
      status: z.enum(['OPEN', 'FULL', 'CANCELLED', 'COMPLETED']).optional(),
    }).safeParse(req.query)
    if (!parsed.success) return reply.status(400).send({ success: false, error: 'Invalid query' })

    let userId: number | null = null
    try { await req.jwtVerify(); userId = req.user.id } catch {}

    const where: any = {}
    if (parsed.data.locationId) where.locationId = parsed.data.locationId
    if (parsed.data.status) where.status = parsed.data.status
    if (parsed.data.date) {
      const start = new Date(parsed.data.date)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      where.startsAt = { gte: start, lt: end }
    }

    const meetups = await prisma.boardGameMeetup.findMany({
      where,
      include: {
        game: true,
        location: { select: { id: true, slug: true, name: true } },
        creator: { select: { id: true, firstName: true, lastName: true, username: true } },
        participants: { where: { status: 'JOINED' }, select: { userId: true } },
      },
      orderBy: { startsAt: 'asc' },
    })

    return reply.send({
      success: true,
      meetups: meetups.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        startsAt: m.startsAt,
        maxPlayers: m.maxPlayers,
        status: m.status,
        participantsCount: m.participants.length,
        location: m.location,
        game: m.game,
        creator: { id: m.creator.id, displayName: displayName(m.creator) },
        isJoined: userId ? m.participants.some((p) => p.userId === userId) : false,
      })),
    })
  })

  app.post('/board-game-meetups', { preHandler: requireAuth }, async (req: any, reply) => {
    if (!(await requireActiveUser(req, reply))) return
    const parsed = meetupCreateSchema.safeParse(req.body)
    if (!parsed.success) return reply.status(400).send({ success: false, error: 'Invalid payload' })

    const startsAt = new Date(parsed.data.startsAt)
    if (Number.isNaN(startsAt.getTime()) || startsAt <= new Date()) {
      return reply.status(400).send({ success: false, error: 'startsAt must be in the future' })
    }

    const activeCount = await prisma.boardGameMeetup.count({
      where: { creatorId: req.user.id, status: { in: ['OPEN', 'FULL'] }, startsAt: { gte: new Date() } },
    })
    if (activeCount >= 3) return reply.status(400).send({ success: false, error: 'Active meetup limit reached (3)' })

    const canCreate = await rateLimitByUser(req.user.id, 'meetup-create-day', 5, 86400)
    if (!canCreate) return reply.status(429).send({ success: false, error: 'Daily meetup create limit reached' })

    if (parsed.data.locationId) {
      const location = await prisma.location.findUnique({ where: { id: parsed.data.locationId }, select: { id: true, isActive: true } })
      if (!location || !location.isActive) return reply.status(400).send({ success: false, error: 'Location not found or inactive' })
    }

    const created = await prisma.boardGameMeetup.create({
      data: {
        gameId: parsed.data.gameId,
        creatorId: req.user.id,
        locationId: parsed.data.locationId,
        title: parsed.data.title,
        description: parsed.data.description,
        startsAt,
        maxPlayers: parsed.data.maxPlayers,
      },
    })

    await prisma.boardGameMeetupParticipant.upsert({
      where: { meetupId_userId: { meetupId: created.id, userId: req.user.id } },
      update: { status: 'JOINED' },
      create: { meetupId: created.id, userId: req.user.id, status: 'JOINED' },
    })

    return reply.send({ success: true, meetup: created })
  })

  app.post('/board-game-meetups/:id/join', { preHandler: requireAuth }, async (req: any, reply) => {
    if (!(await requireActiveUser(req, reply))) return
    const id = String(req.params.id)
    const allowed = await rateLimitByUser(req.user.id, 'meetup-joinleave-hour', 20, 3600)
    if (!allowed) return reply.status(429).send({ success: false, error: 'Too many join/leave actions' })

    const meetup = await prisma.boardGameMeetup.findUnique({ where: { id }, include: { participants: { where: { status: 'JOINED' } } } })
    if (!meetup) return reply.status(404).send({ success: false, error: 'Meetup not found' })
    if (meetup.status !== 'OPEN' && meetup.status !== 'FULL') return reply.status(400).send({ success: false, error: 'Meetup is not open' })

    const alreadyJoined = meetup.participants.some((p) => p.userId === req.user.id)
    if (alreadyJoined) return reply.send({ success: true, joined: true, status: meetup.status })

    if (meetup.participants.length >= meetup.maxPlayers) {
      await prisma.boardGameMeetup.update({ where: { id }, data: { status: 'FULL' } })
      return reply.status(400).send({ success: false, error: 'No seats left' })
    }

    const participant = await prisma.boardGameMeetupParticipant.upsert({
      where: { meetupId_userId: { meetupId: id, userId: req.user.id } },
      update: { status: 'JOINED' },
      create: { meetupId: id, userId: req.user.id, status: 'JOINED' },
    })

    const joinedCount = await prisma.boardGameMeetupParticipant.count({ where: { meetupId: id, status: 'JOINED' } })
    const status = joinedCount >= meetup.maxPlayers ? 'FULL' : 'OPEN'
    await prisma.boardGameMeetup.update({ where: { id }, data: { status } })

    return reply.send({ success: true, participant, status })
  })

  app.post('/board-game-meetups/:id/leave', { preHandler: requireAuth }, async (req: any, reply) => {
    const id = String(req.params.id)
    const allowed = await rateLimitByUser(req.user.id, 'meetup-joinleave-hour', 20, 3600)
    if (!allowed) return reply.status(429).send({ success: false, error: 'Too many join/leave actions' })

    const participant = await prisma.boardGameMeetupParticipant.findUnique({ where: { meetupId_userId: { meetupId: id, userId: req.user.id } } })
    if (!participant) return reply.status(404).send({ success: false, error: 'Participant not found' })

    await prisma.boardGameMeetupParticipant.update({ where: { meetupId_userId: { meetupId: id, userId: req.user.id } }, data: { status: 'CANCELLED' } })

    const meetup = await prisma.boardGameMeetup.findUnique({ where: { id } })
    if (meetup?.status === 'FULL') {
      const joinedCount = await prisma.boardGameMeetupParticipant.count({ where: { meetupId: id, status: 'JOINED' } })
      if (joinedCount < meetup.maxPlayers) {
        await prisma.boardGameMeetup.update({ where: { id }, data: { status: 'OPEN' } })
      }
    }

    return reply.send({ success: true })
  })

  app.post('/board-game-meetups/:id/cancel', { preHandler: requireAuth }, async (req: any, reply) => {
    const id = String(req.params.id)
    const meetup = await prisma.boardGameMeetup.findUnique({ where: { id } })
    if (!meetup) return reply.status(404).send({ success: false, error: 'Meetup not found' })

    const isAdmin = ['ADMIN', 'OWNER'].includes(req.user.role)
    if (!isAdmin && meetup.creatorId !== req.user.id) return reply.status(403).send({ success: false, error: 'Forbidden' })

    await prisma.boardGameMeetup.update({ where: { id }, data: { status: 'CANCELLED' } })
    return reply.send({ success: true })
  })

  app.get('/events', async (req: any, reply) => {
    const parsed = eventsQuerySchema.safeParse(req.query)
    if (!parsed.success) return reply.status(400).send({ success: false, error: 'Invalid query' })

    let userId: number | null = null
    try { await req.jwtVerify(); userId = req.user.id } catch {}

    const where: any = {}
    if (parsed.data.type) where.type = parsed.data.type
    if (parsed.data.locationId) where.locationId = parsed.data.locationId
    if (parsed.data.upcoming) where.startsAt = { gte: new Date() }

    const events = await prisma.communityEvent.findMany({
      where,
      include: {
        location: { select: { id: true, slug: true, name: true } },
        participants: { where: { status: 'GOING' }, select: { userId: true } },
      },
      orderBy: { startsAt: 'asc' },
    })

    return reply.send({
      success: true,
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        title: e.title,
        description: e.description,
        imageUrl: e.imageUrl,
        location: e.location,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        capacity: e.capacity,
        status: e.status,
        participantsCount: e.participants.length,
        isJoined: userId ? e.participants.some((p) => p.userId === userId) : false,
      })),
    })
  })

  app.get('/events/:id', async (req: any, reply) => {
    const id = String(req.params.id)
    let userId: number | null = null
    try { await req.jwtVerify(); userId = req.user.id } catch {}

    const event = await prisma.communityEvent.findUnique({
      where: { id },
      include: {
        location: { select: { id: true, slug: true, name: true } },
        participants: { where: { status: 'GOING' }, select: { userId: true } },
        movieOptions: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: { votes: { select: { userId: true } } },
        },
      },
    })
    if (!event) return reply.status(404).send({ success: false, error: 'Event not found' })

    return reply.send({
      success: true,
      event: {
        id: event.id,
        type: event.type,
        title: event.title,
        description: event.description,
        imageUrl: event.imageUrl,
        location: event.location,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        capacity: event.capacity,
        status: event.status,
        participantsCount: event.participants.length,
        isJoined: userId ? event.participants.some((p) => p.userId === userId) : false,
        movieOptions: event.movieOptions.map((o) => ({
          id: o.id,
          title: o.title,
          posterUrl: o.posterUrl,
          votesCount: o.votes.length,
          isVotedByMe: userId ? o.votes.some((v) => v.userId === userId) : false,
        })),
      },
    })
  })

  app.post('/events/:id/join', { preHandler: requireAuth }, async (req: any, reply) => {
    if (!(await requireActiveUser(req, reply))) return
    const id = String(req.params.id)
    const event = await prisma.communityEvent.findUnique({ where: { id }, include: { participants: { where: { status: 'GOING' } } } })
    if (!event) return reply.status(404).send({ success: false, error: 'Event not found' })
    if (event.status !== 'PUBLISHED') return reply.status(400).send({ success: false, error: 'Event is not published' })
    if (event.startsAt <= new Date()) return reply.status(400).send({ success: false, error: 'Event already started' })
    if (event.capacity && event.participants.length >= event.capacity) return reply.status(400).send({ success: false, error: 'Event is full' })

    await prisma.communityEventParticipant.upsert({
      where: { eventId_userId: { eventId: id, userId: req.user.id } },
      update: { status: 'GOING' },
      create: { eventId: id, userId: req.user.id, status: 'GOING' },
    })

    return reply.send({ success: true })
  })

  app.post('/events/:id/leave', { preHandler: requireAuth }, async (req: any, reply) => {
    const id = String(req.params.id)
    await prisma.communityEventParticipant.upsert({
      where: { eventId_userId: { eventId: id, userId: req.user.id } },
      update: { status: 'CANCELLED' },
      create: { eventId: id, userId: req.user.id, status: 'CANCELLED' },
    })
    return reply.send({ success: true })
  })

  app.post('/events/:id/vote-movie', { preHandler: requireAuth }, async (req: any, reply) => {
    if (!(await requireActiveUser(req, reply))) return
    const id = String(req.params.id)
    const body = z.object({ optionId: z.string().cuid() }).safeParse(req.body)
    if (!body.success) return reply.status(400).send({ success: false, error: 'Invalid payload' })

    const event = await prisma.communityEvent.findUnique({ where: { id } })
    if (!event) return reply.status(404).send({ success: false, error: 'Event not found' })
    if (event.type !== 'MOVIE_NIGHT') return reply.status(400).send({ success: false, error: 'Movie voting is available only for movie nights' })
    if (event.startsAt <= new Date()) return reply.status(400).send({ success: false, error: 'Voting closed' })

    const option = await prisma.movieOption.findFirst({ where: { id: body.data.optionId, eventId: id } })
    if (!option) return reply.status(400).send({ success: false, error: 'Movie option not found' })

    await prisma.movieVote.upsert({
      where: { eventId_userId: { eventId: id, userId: req.user.id } },
      update: { optionId: body.data.optionId },
      create: { eventId: id, userId: req.user.id, optionId: body.data.optionId },
    })

    return reply.send({ success: true })
  })
}
