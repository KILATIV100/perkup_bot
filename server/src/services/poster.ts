import { PrismaClient } from '@prisma/client'
import Redis from 'ioredis'

const prisma = new PrismaClient()
const redisCache = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

interface PosterItem {
  product_id: string | number
  product_name: string
  product_price?: string | number
  price?: Record<string, string>
  menu_category_id?: string | number
  photo?: string
  out?: number
  product_production_description?: string
}

interface Location {
  id: number
  slug: string
}

const LOCATIONS = [
  { slug: 'krona', subdomain: process.env.POSTER_KRONA_SUBDOMAIN || 'perkup2', token: process.env.POSTER_KRONA_TOKEN || '' },
  { slug: 'pryozerny', subdomain: process.env.POSTER_PRYOZERNY_SUBDOMAIN || 'perkup', token: process.env.POSTER_PRYOZERNY_TOKEN || '' },
]

const CATEGORY_ID_MAP: Record<string, string> = {
  '1': 'coffee',
  '3': 'cold',
  '5': 'addons',
  '6': 'coffee',
  '7': 'sweets',
  '8': 'food',
  '9': 'beans',
  '10': 'sweets',
  '11': 'merch',
  '12': 'food',
}

function mapCategory(categoryId: string): string {
  return CATEGORY_ID_MAP[categoryId] || 'other'
}

function parsePrice(item: PosterItem): number {
  if (item.price && typeof item.price === 'object') {
    const vals = Object.values(item.price)
    if (vals.length > 0) {
      return parseFloat(vals[0]) / 100
    }
  }
  if (item.product_price) {
    return parseFloat(String(item.product_price)) / 100
  }
  return 0
}

function buildImageUrl(photo: string | undefined, subdomain: string): string | undefined {
  if (!photo || photo === '0' || photo === '') return undefined
  if (photo.startsWith('http')) return photo
  return 'https://' + subdomain + '.joinposter.com' + photo + '.jpg'
}

export async function syncPosterMenu(locationSlug: string): Promise<{ synced: number; errors: string[] }> {
  const locConfig = LOCATIONS.find(function(l) { return l.slug === locationSlug })
  if (!locConfig || !locConfig.token) throw new Error('No config for ' + locationSlug)

  const location: Location | null = await prisma.location.findUnique({ where: { slug: locationSlug } })
  if (!location) throw new Error('Location not found: ' + locationSlug)

  const errors: string[] = []
  let synced = 0

  const url = 'https://' + locConfig.subdomain + '.joinposter.com/api/menu.getProducts?token=' + locConfig.token
  const res = await fetch(url)
  if (!res.ok) throw new Error('Poster API ' + res.status)

  const data = await res.json() as { response: unknown }
  if (!data.response) throw new Error('Bad Poster response')

  let products: PosterItem[]
  if (Array.isArray(data.response)) {
    products = data.response as PosterItem[]
  } else {
    products = Object.values(data.response as Record<string, PosterItem>)
  }

  console.log('[Poster] ' + products.length + ' products for ' + locationSlug)

  for (let i = 0; i < products.length; i++) {
    const item = products[i]
    try {
      const price = parsePrice(item)
      const categoryId = String(item.menu_category_id || '0')
      const category = mapCategory(categoryId)
      const posterProductId = String(item.product_id)
      const name = String(item.product_name || '')
      const isAvailable = item.out !== 1
      const description = item.product_production_description ? String(item.product_production_description) : null
      const imageUrl = buildImageUrl(item.photo, locConfig.subdomain)

      const existing = await prisma.product.findFirst({ where: { posterProductId: posterProductId } })

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            name: name,
            price: price,
            category: category,
            imageUrl: imageUrl,
            isAvailable: isAvailable,
            description: description,
          },
        })
      } else {
        await prisma.product.create({
          data: {
            locationId: location.id,
            posterProductId: posterProductId,
            name: name,
            price: price,
            category: category,
            imageUrl: imageUrl,
            isAvailable: isAvailable,
            description: description,
            allergens: [],
            tags: [],
          },
        })
      }
      synced++
    } catch (e) {
      errors.push(String(item.product_id) + ': ' + String(e))
    }
  }

  await redisCache.del('menu:' + locationSlug)
  console.log('[Poster] Synced ' + synced + '/' + products.length + ' for ' + locationSlug)
  return { synced: synced, errors: errors }
}

export async function syncAllLocations(): Promise<void> {
  for (let i = 0; i < LOCATIONS.length; i++) {
    const loc = LOCATIONS[i]
    try {
      await syncPosterMenu(loc.slug)
    } catch (e) {
      console.error('[Poster] Failed ' + loc.slug, String(e))
    }
  }
}
