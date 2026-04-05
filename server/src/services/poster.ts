import axios from 'axios'
import { prisma } from '../lib/prisma'
import { redisCache } from '../lib/redis'

const LOCATIONS = [
  { slug: 'krona', subdomain: process.env.POSTER_KRONA_SUBDOMAIN || 'perkup2', token: process.env.POSTER_KRONA_TOKEN || '' },
  { slug: 'pryozerny', subdomain: process.env.POSTER_PRYOZERNY_SUBDOMAIN || 'perkup', token: process.env.POSTER_PRYOZERNY_TOKEN || '' },
]

// Stable mapping by Poster menu_category_id (preferred).
// Fallback by category name is kept for unknown IDs.
const CATEGORY_ID_MAP: Record<string, string> = {
  '1': 'coffee',   // Кава
  '3': 'cold',     // Холодні напої
  '6': 'coffee',   // Не кава (авторські)
  '7': 'sweets',   // Солодощі
  '8': 'food',     // Їжа
  '9': 'beans',    // Кава на продаж
  '10': 'sweets',  // Морозиво
  '11': 'merch',   // Мерч
  '12': 'food',    // Дитяче меню
}

const CATEGORY_NAME_FALLBACK: Record<string, string> = {
  'кава': 'coffee',
  'coffee': 'coffee',
  'кофе': 'coffee',
  'холод': 'cold',
  'лимонад': 'cold',
  'їжа': 'food',
  'food': 'food',
  'випічка': 'food',
  'десерт': 'sweets',
  'морозив': 'sweets',
  'мерч': 'merch',
  'зерн': 'beans',
}

function mapCategory(item: any): string {
  const categoryId = String(item.menu_category_id || item.category_id || '').trim()
  if (categoryId && CATEGORY_ID_MAP[categoryId]) {
    return CATEGORY_ID_MAP[categoryId]
  }

  const name = String(item.category_name || item.menu_category_name || '').toLowerCase()
  for (const [key, val] of Object.entries(CATEGORY_NAME_FALLBACK)) {
    if (name.includes(key)) return val
  }

  return 'coffee'
}

function firstDefinedString(...values: any[]): string {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      const str = String(value).trim()
      if (str) return str
    }
  }
  return ''
}

// Poster price can be a string/number in cents, or an object per spot.
function extractPriceUah(item: any): number {
  const rawCandidates = [item.product_price, item.price, item.menu_price]

  for (const raw of rawCandidates) {
    if (raw === undefined || raw === null) continue

    if (typeof raw === 'number') {
      return Number.isFinite(raw) ? raw / 100 : 0
    }

    if (typeof raw === 'string') {
      const n = parseFloat(raw)
      if (Number.isFinite(n)) return n / 100
    }

    if (typeof raw === 'object') {
      for (const value of Object.values(raw)) {
        const n = parseFloat(String(value))
        if (Number.isFinite(n)) return n / 100
      }
    }
  }

  return 0
}

export async function syncPosterMenu(locationSlug: string): Promise<{ synced: number; errors: string[] }> {
  const loc = LOCATIONS.find(l => l.slug === locationSlug)
  if (!loc || !loc.token) throw new Error('No config for ' + locationSlug)
  const location = await prisma.location.findUnique({ where: { slug: locationSlug } })
  if (!location) throw new Error('Location not found: ' + locationSlug)
  const errors: string[] = []
  let synced = 0
  // IMPORTANT: do not pass type=products here.
  // In Poster some coffee items are stored as tech cards and are filtered out by type=products.
  const url = 'https://' + loc.subdomain + '.joinposter.com/api/menu.getProducts?token=' + loc.token
  const res = await fetch(url)
  if (!res.ok) throw new Error('Poster API ' + res.status)
  const data = await res.json() as any
  if (!data.response) throw new Error('Bad Poster response')
  const products = Array.isArray(data.response) ? data.response : Object.values(data.response as Record<string, unknown>)
  const syncedPosterIds = new Set<string>()
  console.log('[Poster] ' + products.length + ' products for ' + locationSlug)
  for (const item of products as any[]) {
    try {
      const posterProductId = firstDefinedString(item.product_id, item.productid, item.id)
      if (!posterProductId) {
        errors.push('unknown-id: empty product id')
        continue
      }
      syncedPosterIds.add(posterProductId)
      const price = extractPriceUah(item)
      const category = mapCategory(item)
      const name = firstDefinedString(item.product_name, item.name, item.product_title)
      if (!name) {
        errors.push(`${posterProductId}: empty product name`)
        continue
      }
      await prisma.product.upsert({
        where: {
          locationId_posterProductId: {
            locationId: location.id,
            posterProductId,
          },
        },
        // We intentionally do not sync external Poster image links into menu items.
        // Media must be managed via approved channels (e.g. Telegram file storage/proxy).
        update: { name, price, category, isAvailable: String(item.out) !== '1', description: item.product_production_description || item.description || null },
        create: { locationId: location.id, posterProductId, name, price, category, isAvailable: String(item.out) !== '1', description: item.product_production_description || item.description || null, allergens: [], tags: [] },
      })
      synced++
    } catch (err: any) { errors.push(item.product_id + ': ' + err.message) }
  }

  if (errors.length) {
    console.warn(`[Poster] ${locationSlug} sync warnings: ${errors.length}`)
  }

  // Keep local menu aligned with Poster: hide products no longer present in Poster response.
  await prisma.product.updateMany({
    where: {
      locationId: location.id,
      posterProductId: { not: null, notIn: [...syncedPosterIds] },
    },
    data: { isAvailable: false },
  })

  await redisCache.del('menu:' + locationSlug)
  return { synced, errors }
}

export async function syncAllLocations(): Promise<void> {
  for (const loc of LOCATIONS) {
    try { await syncPosterMenu(loc.slug) } catch (err: any) { console.error('[Poster] Failed ' + loc.slug, err.message) }
  }
}

export const createPosterClient = (token: string) => {
  return axios.create({
    baseURL: 'https://joinposter.com/api',
    params: { token },
  })
}

export async function createIncomingOrderInPoster(orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: true, location: true },
  })

  if (!order) throw new Error('Order not found')
  if (!order.location.hasPoster || !order.location.posterToken || !order.location.posterSpotId) {
    throw new Error('Location is not configured for Poster POS')
  }

  const posterApi = createPosterClient(order.location.posterToken)
  const products = order.items
    .filter((item) => !!item.productId)
    .map((item) => ({
      product_id: item.productId,
      count: item.quantity,
      price: Number(item.price),
    }))

  const payload = {
    spot_id: order.location.posterSpotId,
    phone: order.user.username || '',
    products,
    payment: {
      type: 0,
      sum: 0,
      currency: 'UAH',
    },
    comment: `TG Замовлення #${String(order.id).slice(-4)}\nГість: ${order.user.firstName}`,
  }

  try {
    const response = await posterApi.post('/incomingOrders.createIncomingOrder', payload)
    if (response.data?.error) {
      throw new Error(`Poster Error: ${response.data.error}`)
    }

    const posterOrderId = response.data?.response?.incoming_order_id
    if (!posterOrderId) {
      throw new Error('Poster response does not contain incoming_order_id')
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        posterOrderId: String(posterOrderId),
        status: 'SENT_TO_POS',
      },
    })

    return response.data.response
  } catch (error) {
    console.error(`Error pushing order ${orderId} to Poster:`, error)
    throw error
  }
}
