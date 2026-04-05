import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { syncAllLocations, syncPosterMenu } from '../services/poster'

export default async function adminRoutes(app: FastifyInstance) {

  app.post('/sync', async (_req: any, reply: any) => {
    syncAllLocations().catch(e => console.error('[Admin sync error]', e))
    return reply.send({ success: true, message: 'Sync started' })
  })

  app.post('/sync/:slug', async (req: any, reply: any) => {
    const slug = req.params.slug
    try {
      const result = await syncPosterMenu(slug)
      return reply.send({ success: true, ...result })
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message })
    }
  })

  app.post('/fix-db', async (_req: any, reply: any) => {
    const results: string[] = []
    try {
      // Find all unique constraints on Product table
      const constraints = await prisma.$queryRaw`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'Product'
          AND constraint_type = 'UNIQUE'
      ` as any[]
      results.push('Found constraints: ' + JSON.stringify(constraints.map((c: any) => c.constraint_name)))

      // Drop any constraint that has posterProductId but NOT locationId
      const indexes = await prisma.$queryRaw`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'Product'
      ` as any[]
      results.push('Indexes: ' + JSON.stringify(indexes.map((i: any) => i.indexname)))

      // Try dropping by all known possible names
      const namesToTry = [
        'Product_posterProductId_key',
        'product_posterproductid_key',
        'Product_posterProductId_unique',
      ]
      for (const name of namesToTry) {
        try {
          await prisma.$executeRawUnsafe('ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "' + name + '"')
          results.push('DROP attempted: ' + name)
        } catch (e: any) {
          results.push('DROP failed ' + name + ': ' + e.message)
        }
      }

      // Also try via index
      try {
        await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "Product_posterProductId_key"')
        results.push('Index DROP attempted')
      } catch (e: any) {
        results.push('Index DROP failed: ' + e.message)
      }

      // Now clear pryozerny and re-sync
      const loc = await prisma.location.findUnique({ where: { slug: 'pryozerny' } })
      if (loc) {
        const deleted = await prisma.product.deleteMany({ where: { locationId: loc.id } })
        results.push('Deleted ' + deleted.count + ' pryozerny products')
      }

      return reply.send({ success: true, results })
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message, results })
    }
  })

  app.get('/db-check', async (_req: any, reply: any) => {
    const krona = await prisma.location.findUnique({ where: { slug: 'krona' } })
    const pryozerny = await prisma.location.findUnique({ where: { slug: 'pryozerny' } })
    const kronaCount = krona ? await prisma.product.count({ where: { locationId: krona.id } }) : 0
    const pryCount = pryozerny ? await prisma.product.count({ where: { locationId: pryozerny.id } }) : 0
    const indexes = await prisma.$queryRaw`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Product'
    ` as any[]
    return reply.send({ kronaCount, pryCount, indexes: indexes.map((i: any) => ({ name: i.indexname, def: i.indexdef })) })
  })
}
