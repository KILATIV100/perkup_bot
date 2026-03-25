import { FastifyInstance } from 'fastify'

export default async function adminRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    return reply.send({ success: true, message: 'Admin module — coming in Phase 7' })
  })
}
