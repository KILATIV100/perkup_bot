import axios from 'axios'
import { prisma } from '../lib/prisma'
import { redisCache } from '../lib/redis'
import { getLocationProfile } from '../lib/locationProfile'
import { normalizePhoneOrThrow } from '../lib/phone'

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

async function getPosterLocationConfig(locationSlug: string) {
  const location = await prisma.location.findUnique({ where: { slug: locationSlug } })
  if (!location) throw new Error('Location not found: ' + locationSlug)
  if (!location.hasPoster) throw new Error('Poster is disabled for location: ' + locationSlug)
  if (!location.posterSubdomain) throw new Error('Poster subdomain is missing for location: ' + locationSlug)
  if (!location.posterToken) throw new Error('Poster token is missing for location: ' + locationSlug)

  return {
    location,
    subdomain: location.posterSubdomain,
    token: location.posterToken,
  }
}

function getPosterServiceMode(location: { slug: string }): 1 | 2 | 3 {
  const profile = getLocationProfile(location)
  if (profile.format === 'TO_GO') return 1
  return 2
}

export async function createPosterIncomingOrder(input: {
  location: {
    id: number
    name: string
    slug: string
    posterToken: string | null
    posterSpotId: number | null
    hasPoster: boolean
  }
  firstName: string
  lastName?: string | null
  phone: string
  comment?: string | null
  products: Array<{ product_id: number; count: number }>
}) {
  if (!input.location.hasPoster) {
    throw new Error('Poster is disabled for this location')
  }
  if (!input.location.posterToken) {
    throw new Error(`Poster token is missing for ${input.location.name}`)
  }
  if (!input.location.posterSpotId) {
    throw new Error(`Poster spot ID is missing for ${input.location.name}`)
  }
  if (input.products.length === 0) {
    throw new Error('Poster order requires at least one product')
  }

  const payload: Record<string, unknown> = {
    spot_id: input.location.posterSpotId,
    phone: normalizePhoneOrThrow(input.phone),
    first_name: input.firstName,
    service_mode: getPosterServiceMode(input.location),
    products: input.products,
  }

  if (input.lastName) payload.last_name = input.lastName
  if (input.comment) payload.comment = input.comment

  const response = await axios.post(
    `https://joinposter.com/api/incomingOrders.createIncomingOrder?token=${input.location.posterToken}`,
    payload,
    { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
  )

  const incomingOrderId = response.data?.response?.incoming_order_id
  if (!incomingOrderId) {
    throw new Error('Poster did not return incoming_order_id')
  }

  return {
    incomingOrderId: String(incomingOrderId),
    raw: response.data,
  }
}

export async function syncPosterMenu(locationSlug: string): Promise<{ synced: number; errors: string[] }> {
  const cfg = await getPosterLocationConfig(locationSlug)
  const { location } = cfg

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
      const posterImageUrl = buildImageUrl(item.photo, cfg.subdomain)
      const isAvailable = item.out !== 1
      const description = item.product_production_description
        ? String(item.product_production_description)
        : null

      const existing = await prisma.product.findFirst({
        where: { locationId: location.id, posterProductId },
      })

      if (existing) {
        const updateData: any = { name, price, category, isAvailable }
        if (posterImageUrl) updateData.posterImageUrl = posterImageUrl
        if ((!existing.description || !String(existing.description).trim()) && description) {
          updateData.description = description
        }

        await prisma.product.update({
          where: { id: existing.id },
          data: updateData,
        })
      } else {
        await prisma.product.create({
          data: {
            locationId: location.id,
            posterProductId,
            name, price, category, posterImageUrl,
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
  const locations = await prisma.location.findMany({
    where: { hasPoster: true, isActive: true },
    select: { slug: true },
    orderBy: { id: 'asc' },
  })

  for (const location of locations) {
    try {
      const result = await syncPosterMenu(location.slug)
      console.log('[Poster] ' + location.slug + ' OK: ' + result.synced + ' products')
    } catch (e: any) {
      console.error('[Poster] ' + location.slug + ' FAILED: ' + (e?.message || String(e)))
    }
  }
}
