import { prisma } from '../lib/prisma'
import { redisCache } from '../lib/redis'

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

function parsePrice(item: any): number {
  // Poster зберігає ціни в об'єкті price по spot_id, в копійках
  // Спробуємо price["1"] (перший spot) або product_price
  if (item.price && typeof item.price === 'object') {
    const spotPrices = Object.values(item.price as Record<string, string>)
    if (spotPrices.length > 0) {
      const kopecks = parseFloat(String(spotPrices[0])) || 0
      return kopecks / 100
    }
  }
  // Fallback до product_price
  if (item.product_price) {
    return parseFloat(String(item.product_price)) / 100
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

  const url = 'https://' + loc.subdomain + '.joinposter.com/api/menu.getProducts?token=' + loc.token
  const res = await fetch(url)
  if (!res.ok) throw new Error('Poster API ' + res.status)
  const data = await res.json() as any
  if (!data.response) throw new Error('Bad Poster response')

  const products = Array.isArray(data.response)
    ? data.response
    : Object.values(data.response as Record<string, unknown>)

  console.log('[Poster] ' + products.length + ' products for ' + locationSlug)

  for (const item of products as any[]) {
    try {
      const price = parsePrice(item)
      const categoryId = String(item.menu_category_id || '0')
      const category = mapCategory(categoryId)
      const posterProductId = String(item.product_id)

      let imageUrl: string | undefined
      if (item.photo && item.photo !== '0' && item.photo !== '') {
        const photo = String(item.photo)
        imageUrl = photo.startsWith('http')
          ? photo
          : 'https://' + loc.subdomain + '.joinposter.com' + photo + '.jpg'
      }

      const existing = await prisma.product.findFirst({
        where: { posterProductId },
      })

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            name: item.product_name,
            price,
            category,
            imageUrl,
            isAvailable: item.out !== 1,
            description: item.product_production_description || null,
          },
        })
      } else {
        await prisma.product.create({
          data: {
            locationId: location.id,
            posterProductId,
            name: item.product_name,
            price,
            category,
            imageUrl,
            isAvailable: item.out !== 1,
            description: item.product_production_description || null,
            allergens: [],
            tags: [],
          },
        })
      }
      synced++
    } catch (err: any) {
      errors.push(item.product_id + ': ' + err.message)
    }
  }

  await redisCache.del('menu:' + locationSlug)
  console.log('[Poster] Synced ' + synced + '/' + (products as any[]).length + ' for ' + locationSlug)
  return { synced, errors }
}

export async function syncAllLocations(): Promise<void> {
  for (const loc of LOCATIONS) {
    try {
      await syncPosterMenu(loc.slug)
    } catch (err: any) {
      console.error('[Poster] Failed ' + loc.slug, err.message)
    }
  }
}
