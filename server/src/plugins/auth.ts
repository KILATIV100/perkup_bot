import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: number; role: string }
    user: { id: number; role: string }
  }
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply) {
  try {
    await req.jwtVerify()
  } catch {
    reply.status(401).send({ success: false, error: 'Unauthorized' })
    return
  }
}

export function requireRole(...roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await authenticate(req, reply)
    if (reply.sent) return
    if (!roles.includes(req.user.role)) {
      return reply.status(403).send({ success: false, error: 'Forbidden' })
    }
  }
}

export const requireBarista = requireRole('BARISTA', 'ADMIN', 'OWNER')
export const requireAdmin = requireRole('ADMIN', 'OWNER')
export const requireOwner = requireRole('OWNER')
