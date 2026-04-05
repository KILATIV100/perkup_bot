import { prisma } from '../lib/prisma'
import { redisCache } from '../lib/redis'

const LOCATION_CONFIGS: Record<string, { subdomain: string; token: string }> = {
  krona: {
    subdomain: 'perkup2',
    token: '400311:442859326f65b2aa1974a9ebd303b8a8',
  },
  pryozerny: {
    subdomain: 'perkup',
    token: '483421:44288031aab04be166b1455d61771e0f',
  },
}

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
  if (p.startsWith('http')) return p
  return 'https://' + subdomain + '.joinposter.com' + p
}

export async function syncPosterMenu(locationSlug: string): Promise<{ synced: number; errors: string[] }> {
  const cfg = LOCATION_CONFIGS[locationSlug]
  if (!cfg) throw new Error('No config for slug: ' + locationSlug)

  const location = await prisma.location.findUnique({ where: { slug: locationSlug } })
  if (!location) throw new Error('Location not found: ' + locationSlug)

  console.log('[Poster] Sync ' + locationSlug + ' via ' + cfg.subdomain + '.joinposter.com')

  const url = 'https://' + cfg.subdomain + '.joinposter.com/api/menu.getProducts?token=' + cfg.token
  const res = await fetch(url)
  if (!res.ok) throw new Error('Poster API error: ' + res.status)

  const data = await res.json() as any
  if (!data.response) throw new Error('Bad Poster response for ' + locationSlug)

  const products: any[] = Array.isArray(data.response)
    ? data.response
    : Object.values(data.response)

  console.log('[Poster] Got ' + products.length + ' products for ' + locationSlug)

  const errors: string[] = []
  let synced = 0

  for (const item of products) {
    try {
      const posterProductId = String(item.product_id)
      const name = String(item.product_name || '')
      const price = parsePrice(item)
      const category = mapCategory(String(item.menu_category_id || '0'))
      const imageUrl = buildImageUrl(item.photo, cfg.subdomain)
      const isAvailable = item.out !== 1
      const description = item.product_production_description
        ? String(item.product_production_description)
        : null

      const existing = await prisma.product.findFirst({
        where: { locationId: location.id, posterProductId },
      })

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: { name, price, category, imageUrl, isAvailable, description },
        })
      } else {
        await prisma.product.create({
          data: {
            locationId: location.id,
            posterProductId,
            name, price, category, imageUrl,
            isAvailable, description,
            allergens: [], tags: [],
          },
        })
      }
      synced++
    } catch (e: any) {
      errors.push(String(item.product_id) + ': ' + (e?.message || String(e)))
    }
  }

  // Remove products no longer in Poster
  const posterIds = products.map((p: any) => String(p.product_id))
  const removed = await prisma.product.deleteMany({
    where: {
      locationId: location.id,
      posterProductId: { notIn: posterIds },
    },
  })
  if (removed.count > 0) {
    console.log('[Poster] Removed ' + removed.count + ' stale products for ' + locationSlug)
  }

  await redisCache.del('menu:' + locationSlug)
  console.log('[Poster] Done ' + locationSlug + ': ' + synced + '/' + products.length + ', errors: ' + errors.length)
  return { synced, errors }
}

export async function syncAllLocations(): Promise<void> {
  for (const slug of Object.keys(LOCATION_CONFIGS)) {
    try {
      const result = await syncPosterMenu(slug)
      console.log('[Poster] ' + slug + ' OK: ' + result.synced + ' products')
    } catch (e: any) {
      console.error('[Poster] ' + slug + ' FAILED: ' + (e?.message || String(e)))
    }
  }
}
