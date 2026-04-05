import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { syncAllLocations, syncPosterMenu } from '../services/poster'

export default async function adminRoutes(app: FastifyInstance) {

  app.post('/sync', async (req: any, reply) => {
    try {
      syncAllLocations().catch(e => console.error('[Admin sync error]', e))
      return reply.send({ success: true, message: 'Sync started' })
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  app.post('/sync/:slug', async (req: any, reply) => {
    const slug = req.params.slug
    try {
      const result = await syncPosterMenu(slug)
      return reply.send({ success: true, ...result })
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  app.post('/fix-constraints', async (req: any, reply) => {
    try {
      // Drop old global unique constraint on posterProductId if exists
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_posterProductId_key"'
      )
      // Delete all pryozerny products so we can re-sync clean
      const loc = await prisma.location.findUnique({ where: { slug: 'pryozerny' } })
      if (loc) {
        const deleted = await prisma.product.deleteMany({ where: { locationId: loc.id } })
        return reply.send({ success: true, message: 'Constraint dropped, deleted ' + deleted.count + ' pryozerny products. Now run /api/admin/sync/pryozerny' })
      }
      return reply.send({ success: true, message: 'Constraint dropped' })
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  app.get('/db-check', async (req: any, reply) => {
    const krona = await prisma.location.findUnique({ where: { slug: 'krona' } })
    const pryozerny = await prisma.location.findUnique({ where: { slug: 'pryozerny' } })
    const kronaCount = krona ? await prisma.product.count({ where: { locationId: krona.id } }) : 0
    const pryozernyCount = pryozerny ? await prisma.product.count({ where: { locationId: pryozerny.id } }) : 0
    // Check if old unique constraint exists
    const constraints = await prisma.$queryRaw`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'Product' AND constraint_type = 'UNIQUE'
    ` as any[]
    return reply.send({ kronaCount, pryozernyCount, constraints: constraints.map((c: any) => c.constraint_name) })
  })
}
