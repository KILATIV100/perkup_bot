import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ─── LOCATIONS ────────────────────────────────────────────────
  const markMall = await prisma.location.upsert({
    where: { slug: 'mark-mall' },
    update: {
      name: 'Mark Mall',
      address: 'Mark Mall, Бровари',
      lat: 50.5100,
      lng: 30.7900,
      radius: 50,
      allowOrders: false,
      hasPoster: false,
      posterSubdomain: null,
      posterAccount: null,
      posterToken: null,
      posterSpotId: null,
      hasPrinter: true,
      isActive: true,
    },
    create: {
      slug: 'mark-mall',
      name: 'Mark Mall',
      address: 'Mark Mall, Бровари',
      lat: 50.5100,
      lng: 30.7900,
      radius: 50,
      allowOrders: false,
      googlePlaceId: '',
      googleMapsUrl: '',
      hasPrinter: true,
      isActive: true,
    },
  })

  const krona = await prisma.location.upsert({
    where: { slug: 'krona' },
    update: {
      name: 'ЖК Крона Парк 2',
      address: 'ЖК Крона Парк 2, Бровари',
      lat: 50.5150,
      lng: 30.7950,
      radius: 100,
      allowOrders: true,
      hasPoster: true,
      posterSubdomain: 'perkup2',
      posterAccount: '400311',
      posterToken: '400311:442859326f65b2aa1974a9ebd303b8a8',
      hasPrinter: false,
      isActive: true,
    },
    create: {
      slug: 'krona',
      name: 'ЖК Крона Парк 2',
      address: 'ЖК Крона Парк 2, Бровари',
      lat: 50.5150,
      lng: 30.7950,
      radius: 100,
      allowOrders: true,
      hasPoster: true,
      posterSubdomain: 'perkup2',
      posterAccount: '400311',
      posterToken: '400311:442859326f65b2aa1974a9ebd303b8a8',
      googlePlaceId: '',
      googleMapsUrl: '',
      hasPrinter: false,
      isActive: true,
    },
  })

  const pryozerny = await prisma.location.upsert({
    where: { slug: 'pryozerny' },
    update: {
      name: 'Парк Приозерний',
      address: 'Парк Приозерний, Бровари',
      lat: 50.5050,
      lng: 30.7850,
      radius: 100,
      allowOrders: true,
      hasPoster: true,
      posterSubdomain: 'perkup',
      posterAccount: '483421',
      posterToken: '483421:44288031aab04be166b1455d61771e0f',
      hasPrinter: false,
      isActive: true,
    },
    create: {
      slug: 'pryozerny',
      name: 'Парк Приозерний',
      address: 'Парк Приозерний, Бровари',
      lat: 50.5050,
      lng: 30.7850,
      radius: 100,
      allowOrders: true,
      hasPoster: true,
      posterSubdomain: 'perkup',
      posterAccount: '483421',
      posterToken: '483421:44288031aab04be166b1455d61771e0f',
      googlePlaceId: '',
      googleMapsUrl: '',
      hasPrinter: false,
      isActive: true,
    },
  })

  console.log('✅ Locations created')

  // ─── WORKING HOURS ────────────────────────────────────────────
  // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  const defaultHours = [
    { dayOfWeek: 0, openTime: '09:00', closeTime: '21:00', isClosed: false },
    { dayOfWeek: 1, openTime: '08:00', closeTime: '21:00', isClosed: false },
    { dayOfWeek: 2, openTime: '08:00', closeTime: '21:00', isClosed: false },
    { dayOfWeek: 3, openTime: '08:00', closeTime: '21:00', isClosed: false },
    { dayOfWeek: 4, openTime: '08:00', closeTime: '21:00', isClosed: false },
    { dayOfWeek: 5, openTime: '08:00', closeTime: '21:00', isClosed: false },
    { dayOfWeek: 6, openTime: '09:00', closeTime: '21:00', isClosed: false },
  ]

  for (const loc of [markMall, krona, pryozerny]) {
    for (const hours of defaultHours) {
      await prisma.workingHours.upsert({
        where: { locationId_dayOfWeek: { locationId: loc.id, dayOfWeek: hours.dayOfWeek } },
        update: {},
        create: { locationId: loc.id, ...hours },
      })
    }
  }

  console.log('✅ Working hours created')

  // ─── MARK MALL MENU ───────────────────────────────────────────
  const markMallProducts = [
    // Coffee
    { name: 'Еспресо', price: 45, category: 'coffee', description: 'Класичний еспресо', calories: 5, volume: '30мл', tags: ['popular'], allergens: [] },
    { name: 'Американо', price: 55, category: 'coffee', description: 'Еспресо з гарячою водою', calories: 10, volume: '200мл', tags: [], allergens: [] },
    { name: 'Капучино', price: 75, category: 'coffee', description: 'Еспресо, молоко, молочна піна', calories: 120, volume: '250мл', tags: ['popular'], allergens: ['lactose'] },
    { name: 'Латте', price: 80, category: 'coffee', description: 'Еспресо з молоком', calories: 150, volume: '350мл', tags: ['popular'], allergens: ['lactose'] },
    { name: 'Флет Вайт', price: 85, category: 'coffee', description: 'Подвійний еспресо з молоком', calories: 130, volume: '200мл', tags: [], allergens: ['lactose'] },
    { name: 'Раф', price: 95, category: 'coffee', description: 'Вершки, ваніль, еспресо', calories: 200, volume: '250мл', tags: ['new'], allergens: ['lactose'] },
    // Cold drinks
    { name: 'Холодна кава', price: 85, category: 'cold', description: 'Кава з льодом', calories: 80, volume: '350мл', tags: [], allergens: [] },
    { name: 'Матча латте', price: 95, category: 'cold', description: 'Японський зелений чай з молоком', calories: 140, volume: '350мл', tags: ['new', 'vegan'], allergens: ['lactose'] },
    { name: 'Лимонад', price: 65, category: 'cold', description: 'Свіжий лимонад', calories: 90, volume: '400мл', tags: ['vegan'], allergens: [] },
    // Food
    { name: 'Круасан', price: 55, category: 'food', description: 'Масляний круасан', calories: 280, volume: '80г', tags: ['popular'], allergens: ['gluten', 'lactose'] },
    { name: 'Сирник', price: 65, category: 'food', description: 'Домашній сирник', calories: 220, volume: '100г', tags: [], allergens: ['gluten', 'lactose', 'eggs'] },
    { name: 'Тост авокадо', price: 120, category: 'food', description: 'Тост з авокадо та яйцем', calories: 380, volume: '200г', tags: ['popular'], allergens: ['gluten', 'eggs'] },
  ]

  for (const product of markMallProducts) {
    const existing = await prisma.product.findFirst({
      where: { locationId: markMall.id, name: product.name },
    })
    if (!existing) {
      await prisma.product.create({
        data: { ...product, locationId: markMall.id, price: product.price },
      })
    }
  }

  console.log('✅ Mark Mall menu created')

  // ─── MARK MALL BUNDLES ────────────────────────────────────────
  const cappuccino = await prisma.product.findFirst({
    where: { locationId: markMall.id, name: 'Капучино' },
  })
  const croissant = await prisma.product.findFirst({
    where: { locationId: markMall.id, name: 'Круасан' },
  })
  const flatWhite = await prisma.product.findFirst({
    where: { locationId: markMall.id, name: 'Флет Вайт' },
  })
  const syrnik = await prisma.product.findFirst({
    where: { locationId: markMall.id, name: 'Сирник' },
  })

  if (cappuccino && croissant) {
    const bundle1Exists = await prisma.bundle.findFirst({
      where: { locationId: markMall.id, name: 'Ранковий набір ☀️' },
    })
    if (!bundle1Exists) {
      const bundle1 = await prisma.bundle.create({
        data: {
          locationId: markMall.id,
          name: 'Ранковий набір ☀️',
          description: 'Капучино + Круасан зі знижкою 15%',
          price: 110,
          originalPrice: 130,
          discountPct: 15,
          sortOrder: 0,
        },
      })
      await prisma.bundleItem.createMany({
        data: [
          { bundleId: bundle1.id, productId: cappuccino.id, quantity: 1 },
          { bundleId: bundle1.id, productId: croissant.id, quantity: 1 },
        ],
      })
    }
  }

  if (flatWhite && syrnik) {
    const bundle2Exists = await prisma.bundle.findFirst({
      where: { locationId: markMall.id, name: 'Сніданок 🍽️' },
    })
    if (!bundle2Exists) {
      const bundle2 = await prisma.bundle.create({
        data: {
          locationId: markMall.id,
          name: 'Сніданок 🍽️',
          description: 'Флет Вайт + Сирник зі знижкою 15%',
          price: 127,
          originalPrice: 150,
          discountPct: 15,
          sortOrder: 1,
        },
      })
      await prisma.bundleItem.createMany({
        data: [
          { bundleId: bundle2.id, productId: flatWhite.id, quantity: 1 },
          { bundleId: bundle2.id, productId: syrnik.id, quantity: 1 },
        ],
      })
    }
  }

  console.log('✅ Bundles created')

  // ─── OWNER USER ───────────────────────────────────────────────
  // Create owner account (update telegramId to your real one)
  const owner = await prisma.user.upsert({
    where: { telegramId: BigInt(7363233852) },
    update: { role: 'OWNER' },
    create: {
      telegramId: BigInt(7363233852),
      firstName: 'Віталій',
      role: 'OWNER',
      onboardingDone: true,
    },
  })

  console.log('✅ Owner user created (update telegramId!)')
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Seed completed!

Locations:
  - Mark Mall (id: ${markMall.id}) — no orders, manual menu
  - ЖК Крона Парк 2 (id: ${krona.id}) — Poster sync
  - Парк Приозерний (id: ${pryozerny.id}) — Poster sync

⚠️  Update owner telegramId in seed.ts!
    Replace 999999999 with your real Telegram ID
    Find it: send /start to @userinfobot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
