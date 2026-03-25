import { FastifyInstance } from 'fastify'

export default async function orderRoutes(app: FastifyInstance) {
  app.get('/', async (req, reply) => {
    return reply.send({ success: true, message: 'Orders module — coming in Phase 3' })
  })
}
