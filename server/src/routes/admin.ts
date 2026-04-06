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

  app.post('/db-push', async (_req: any, reply: any) => {
    const results: string[] = []
    const run = async (sql: string, label: string) => {
      try {
        await prisma.$executeRawUnsafe(sql)
        results.push('OK: ' + label)
      } catch (e: any) {
        results.push('SKIP: ' + label + ' (' + e.message.split('\n')[0] + ')')
      }
    }

    // Location new columns
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "hasPoster" BOOLEAN NOT NULL DEFAULT false', 'Location.hasPoster')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "posterSubdomain" TEXT', 'Location.posterSubdomain')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "posterAccount" TEXT', 'Location.posterAccount')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "posterToken" TEXT', 'Location.posterToken')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "posterSpotId" INTEGER', 'Location.posterSpotId')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "googlePlaceId" TEXT', 'Location.googlePlaceId')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "googleMapsUrl" TEXT', 'Location.googleMapsUrl')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "busyMode" BOOLEAN NOT NULL DEFAULT false', 'Location.busyMode')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "busyModeUntil" TIMESTAMP', 'Location.busyModeUntil')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "maxQueueSize" INTEGER NOT NULL DEFAULT 10', 'Location.maxQueueSize')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "hasPrinter" BOOLEAN NOT NULL DEFAULT false', 'Location.hasPrinter')
    await run('ALTER TABLE "Location" ADD COLUMN IF NOT EXISTS "printerIp" TEXT', 'Location.printerIp')

    // User new columns
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP', 'User.birthDate')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastBirthdayBonus" INTEGER', 'User.lastBirthdayBonus')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredById" INTEGER', 'User.referredById')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralBonusPaid" BOOLEAN NOT NULL DEFAULT false', 'User.referralBonusPaid')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredLocationId" INTEGER', 'User.preferredLocationId')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT \'uk\'', 'User.language')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "noShowCount" INTEGER NOT NULL DEFAULT 0', 'User.noShowCount')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cashPaymentBlocked" BOOLEAN NOT NULL DEFAULT false', 'User.cashPaymentBlocked')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifSpin" BOOLEAN NOT NULL DEFAULT true', 'User.notifSpin')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notifWinback" BOOLEAN NOT NULL DEFAULT true', 'User.notifWinback')
    await run('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "radioGenre" TEXT DEFAULT \'all\'', 'User.radioGenre')

    // SpinResult and PrizeVoucher
    await run(`CREATE TABLE IF NOT EXISTS "SpinResult" (
      "id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL,
      "prizeId" TEXT NOT NULL, "prizeLabel" TEXT NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`, 'SpinResult table')
    await run('CREATE INDEX IF NOT EXISTS "SpinResult_userId_idx" ON "SpinResult"("userId")', 'SpinResult index')
    await run(`CREATE TABLE IF NOT EXISTS "PrizeVoucher" (
      "id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL, "code" TEXT NOT NULL UNIQUE,
      "prizeId" TEXT NOT NULL, "prizeLabel" TEXT NOT NULL, "prizeType" TEXT NOT NULL,
      "prizeValue" INTEGER NOT NULL DEFAULT 0, "isUsed" BOOLEAN NOT NULL DEFAULT FALSE,
      "usedAt" TIMESTAMP, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`, 'PrizeVoucher table')
    await run('CREATE INDEX IF NOT EXISTS "PrizeVoucher_userId_idx" ON "PrizeVoucher"("userId")', 'PrizeVoucher index')

    // RadioTrack
    await run(`CREATE TABLE IF NOT EXISTS "RadioTrack" (
      "id" SERIAL PRIMARY KEY, "fileId" TEXT NOT NULL, "title" TEXT NOT NULL,
      "artist" TEXT NOT NULL DEFAULT 'PerkUp Radio', "duration" INTEGER NOT NULL DEFAULT 180,
      "genre" TEXT NOT NULL DEFAULT 'lofi', "url" TEXT NOT NULL,
      "position" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`, 'RadioTrack table')

    // New Codex tables
    await run(`CREATE TABLE IF NOT EXISTS "Shift" (
      "id" SERIAL PRIMARY KEY, "locationId" INTEGER NOT NULL, "userId" INTEGER NOT NULL,
      "startedAt" TIMESTAMP NOT NULL DEFAULT NOW(), "endedAt" TIMESTAMP,
      "cashStart" DECIMAL(10,2) NOT NULL DEFAULT 0, "cashEnd" DECIMAL(10,2),
      "ordersCount" INTEGER NOT NULL DEFAULT 0, "revenue" DECIMAL(10,2) NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`, 'Shift table')
    await run(`CREATE TABLE IF NOT EXISTS "Review" (
      "id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL, "orderId" INTEGER,
      "locationId" INTEGER NOT NULL, "rating" INTEGER NOT NULL, "comment" TEXT,
      "isPublic" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`, 'Review table')
    await run(`CREATE TABLE IF NOT EXISTS "Tip" (
      "id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL, "orderId" INTEGER NOT NULL,
      "amount" DECIMAL(10,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`, 'Tip table')
    await run(`CREATE TABLE IF NOT EXISTS "GameSession" (
      "id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL, "gameType" TEXT NOT NULL,
      "score" INTEGER NOT NULL DEFAULT 0, "duration" INTEGER, "reward" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`, 'GameSession table')
    await run(`CREATE TABLE IF NOT EXISTS "RedemptionCode" (
      "id" SERIAL PRIMARY KEY, "code" TEXT NOT NULL UNIQUE, "type" TEXT NOT NULL,
      "value" INTEGER NOT NULL DEFAULT 0, "isUsed" BOOLEAN NOT NULL DEFAULT false,
      "usedById" INTEGER, "usedAt" TIMESTAMP, "expiresAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`, 'RedemptionCode table')
    await run(`CREATE TABLE IF NOT EXISTS "Promo" (
      "id" SERIAL PRIMARY KEY, "code" TEXT NOT NULL UNIQUE, "type" TEXT NOT NULL,
      "value" INTEGER NOT NULL DEFAULT 0, "maxUses" INTEGER, "usedCount" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true, "startsAt" TIMESTAMP, "endsAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`, 'Promo table')

    return reply.send({ success: true, results })
  })

  app.post('/create-tables', async (_req: any, reply: any) => {
    const results: string[] = []
    try {
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SpinResult" (
        "id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL,
        "prizeId" TEXT NOT NULL, "prizeLabel" TEXT NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`)
      results.push('SpinResult: OK')
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SpinResult_userId_idx" ON "SpinResult"("userId")`)
      await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PrizeVoucher" (
        "id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL, "code" TEXT NOT NULL UNIQUE,
        "prizeId" TEXT NOT NULL, "prizeLabel" TEXT NOT NULL, "prizeType" TEXT NOT NULL,
        "prizeValue" INTEGER NOT NULL DEFAULT 0, "isUsed" BOOLEAN NOT NULL DEFAULT FALSE,
        "usedAt" TIMESTAMP, "expiresAt" TIMESTAMP NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )`)
      results.push('PrizeVoucher: OK')
      return reply.send({ success: true, results })
    } catch (e: any) {
      return reply.status(500).send({ success: false, error: e.message, results })
    }
  })

  app.post('/fix-db', async (_req: any, reply: any) => {
    const results: string[] = []
    try {
      const namesToTry = ['Product_posterProductId_key', 'product_posterproductid_key']
      for (const name of namesToTry) {
        try {
          await prisma.$executeRawUnsafe('ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "' + name + '"')
          results.push('DROP: ' + name)
        } catch (e: any) { results.push('SKIP: ' + name) }
      }
      try {
        await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "Product_posterProductId_key"')
        results.push('Index DROP: OK')
      } catch (e: any) { results.push('Index DROP: SKIP') }
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
    let spinCount = 0, voucherCount = 0
    try {
      const s = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM "SpinResult"` as any[]
      spinCount = Number(s[0]?.cnt || 0)
      const v = await prisma.$queryRaw`SELECT COUNT(*) as cnt FROM "PrizeVoucher"` as any[]
      voucherCount = Number(v[0]?.cnt || 0)
    } catch (_e) {}
    return reply.send({ success: true, kronaCount, pryCount, spinCount, voucherCount })
  })

  app.post('/fix-locations', async (_req: any, reply: any) => {
    const r: string[] = []
    try {
      await prisma.$executeRawUnsafe('UPDATE "Location" SET lat = 50.51723, lng = 30.77948, address = 'Chornovola 8V' WHERE slug = 'krona'')
      r.push('krona OK')
      await prisma.$executeRawUnsafe('UPDATE "Location" SET lat = 50.50131, lng = 30.75401, address = 'Fialkovska 27A' WHERE slug = 'pryozerny'')
      r.push('pryozerny OK')
      await prisma.$executeRawUnsafe('UPDATE "Location" SET lat = 50.51482, lng = 30.78220, address = 'Kyivska 239' WHERE slug = 'mark-mall'')
      r.push('mark-mall OK')
      return reply.send({ success: true, results: r })
    } catch (e: any) { return reply.status(500).send({ success: false, error: e.message }) }
  })
}
