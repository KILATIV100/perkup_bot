import { FastifyInstance } from 'fastify'

export default async function loyaltyRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    return reply.send({ success: true, message: 'Loyalty module — coming in Phase 4' })
  })
}
