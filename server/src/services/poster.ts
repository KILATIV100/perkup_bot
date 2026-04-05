import { prisma } from '../lib/prisma'
import { redisCache } from '../lib/redis'

const LOCATIONS = [
  { slug: 'krona', subdomain: process.env.POSTER_KRONA_SUBDOMAIN || 'perkup2', token: process.env.POSTER_KRONA_TOKEN || '' },
  { slug: 'pryozerny', subdomain: process.env.POSTER_PRYOZERNY_SUBDOMAIN || 'perkup', token: process.env.POSTER_PRYOZERNY_TOKEN || '' },
]

const CATEGORY_ID_MAP: Record<string, string> = {
  '1': 'coffee', '3': 'cold', '5': 'addons', '6': 'coffee',
  '7': 'sweets', '8': 'food', '9': 'beans', '10': 'sweets',
  '11': 'merch', '12': 'food',
}

function mapCategory(id: string): string {
  return CATEGORY_ID_MAP[id] || 'other'
}

function parsePrice(item: any): number {
  if (item.price && typeof item.price === 'object') {
    const vals = Object.values(item.price as Record<string, string>)
    if (vals.length > 0) return parseFloat(vals[0]) / 100
  }
  return parseFloat(String(item.product_price || '0')) / 100
}

function buildImageUrl(photo: any, subdomain: string): string | undefined {
  if (!photo || photo === '0' || photo === '') return undefined
  const p = String(photo)
  return p.startsWith('http') ? p : 'https://' + subdomain + '.joinposter.com' + p + '.jpg'
}

export async function syncPosterMenu(locationSlug: string): Promise<{ synced: number; errors: string[] }> {
  const locConfig = LOCATIONS.find(l => l.slug === locationSlug)
  if (!locConfig || !locConfig.token) throw new Error('No config for ' + locationSlug)

  const location = await prisma.location.findUnique({ where: { slug: locationSlug } })
  if (!location) throw new Error('Location not found: ' + locationSlug)

  const errors: string[] = []
  let synced = 0

  const url = 'https://' + locConfig.subdomain + '.joinposter.com/api/menu.getProducts?token=' + locConfig.token
  const res = await fetch(url)
  if (!res.ok) throw new Error('Poster API ' + res.status)

  const data = await res.json() as any
  if (!data.response) throw new Error('Bad Poster response')

  const products: any[] = Array.isArray(data.response)
    ? data.response
    : Object.values(data.response)

  console.log('[Poster] ' + products.length + ' products for ' + locationSlug)

  for (const item of products) {
    try {
      const posterProductId = String(item.product_id)
      const name = String(item.product_name || '')
      const price = parsePrice(item)
      const category = mapCategory(String(item.menu_category_id || '0'))
      const imageUrl = buildImageUrl(item.photo, locConfig.subdomain)
      const isAvailable = item.out !== 1
      const description = item.product_production_description ? String(item.product_production_description) : null

      const existing = await prisma.product.findFirst({ where: { posterProductId } })

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: { name, price, category, imageUrl, isAvailable, description },
        })
      } else {
        await prisma.product.create({
          data: { locationId: location.id, posterProductId, name, price, category, imageUrl, isAvailable, description, allergens: [], tags: [] },
        })
      }
      synced++
    } catch (e: any) {
      errors.push(String(item.product_id) + ': ' + (e?.message || String(e)))
    }
  }

  await redisCache.del('menu:' + locationSlug)
  console.log('[Poster] Synced ' + synced + '/' + products.length + ' for ' + locationSlug)
  return { synced, errors }
}

export async function syncAllLocations(): Promise<void> {
  for (const loc of LOCATIONS) {
    try {
      await syncPosterMenu(loc.slug)
    } catch (e: any) {
      console.error('[Poster] Failed ' + loc.slug, e?.message || String(e))
    }
  }
}
