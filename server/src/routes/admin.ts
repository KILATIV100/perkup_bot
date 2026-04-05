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

  app.post('/create-tables', async (_req: any, reply: any) => {
    const results: string[] = []
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SpinResult" (
          "id"         SERIAL PRIMARY KEY,
          "userId"     INTEGER NOT NULL,
          "prizeId"    TEXT NOT NULL,
          "prizeLabel" TEXT NOT NULL,
          "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `)
      results.push('SpinResult table: OK')

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "SpinResult_userId_idx" ON "SpinResult"("userId")
      `)
      results.push('SpinResult index: OK')

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PrizeVoucher" (
          "id"         SERIAL PRIMARY KEY,
          "userId"     INTEGER NOT NULL,
          "code"       TEXT NOT NULL UNIQUE,
          "prizeId"    TEXT NOT NULL,
          "prizeLabel" TEXT NOT NULL,
          "prizeType"  TEXT NOT NULL,
          "prizeValue" INTEGER NOT NULL DEFAULT 0,
          "isUsed"     BOOLEAN NOT NULL DEFAULT FALSE,
          "usedAt"     TIMESTAMP,
          "expiresAt"  TIMESTAMP NOT NULL,
          "createdAt"  TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `)
      results.push('PrizeVoucher table: OK')

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PrizeVoucher_userId_idx" ON "PrizeVoucher"("userId")
      `)
      results.push('PrizeVoucher index: OK')

      return reply.send({ success: true, results })
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message, results })
    }
  })

  app.post('/fix-db', async (_req: any, reply: any) => {
    const results: string[] = []
    try {
      const indexes = await prisma.$queryRaw`
        SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Product'
      ` as any[]
      results.push('Indexes: ' + JSON.stringify(indexes.map((i: any) => i.indexname)))

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

      try {
        await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "Product_posterProductId_key"')
        results.push('Index DROP attempted')
      } catch (e: any) {
        results.push('Index DROP failed: ' + e.message)
      }

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

    let spinCount = 0
    let voucherCount = 0
    try {
      const spinRes = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM "SpinResult"` as any[]
      spinCount = Number(spinRes[0]?.cnt || 0)
      const voucherRes = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM "PrizeVoucher"` as any[]
      voucherCount = Number(voucherRes[0]?.cnt || 0)
    } catch (_e) {}

    const indexes = await prisma.$queryRaw`
      SELECT indexname FROM pg_indexes WHERE tablename = 'Product'
    ` as any[]

    return reply.send({
      kronaCount, pryCount, spinCount, voucherCount,
      indexes: indexes.map((i: any) => i.indexname)
    })
  })
}
