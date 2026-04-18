import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { getLocationProfile } from '../lib/locationProfile'

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function isLocationOpen(workingHours: any[]): { isOpen: boolean; nextOpenTime?: string } {
  // Europe/Kiev handles DST automatically (UTC+2 winter, UTC+3 summer)
  const kyivStr = new Date().toLocaleString('en-US', { timeZone: 'Europe/Kiev' })
  const kyivNow = new Date(kyivStr)
  const day = kyivNow.getDay()
  const timeStr = kyivNow.getHours().toString().padStart(2, '0') + ':' + kyivNow.getMinutes().toString().padStart(2, '0')

  const todayHours = workingHours.find(h => h.dayOfWeek === day)
  if (!todayHours || todayHours.isClosed) {
    return { isOpen: false }
  }

  const isOpen = timeStr >= todayHours.openTime && timeStr < todayHours.closeTime
  return {
    isOpen,
    nextOpenTime: isOpen ? undefined : todayHours.openTime,
  }
}

export default async function locationRoutes(app: FastifyInstance) {

  // GET /api/locations?lat=...&lng=...
  app.get('/', async (req, reply) => {
    const query = z.object({
      lat: z.coerce.number().optional(),
      lng: z.coerce.number().optional(),
    }).safeParse(req.query)

    const locations = await prisma.location.findMany({
      where: { isActive: true },
      include: { workingHours: true },
      orderBy: { id: 'asc' },
    })

    const result = locations.map(loc => {
      const { isOpen, nextOpenTime } = isLocationOpen(loc.workingHours)
      const profile = getLocationProfile(loc)
      let distanceMeters: number | null = null

      if (query.success && query.data.lat && query.data.lng) {
        distanceMeters = Math.round(
          getDistanceMeters(query.data.lat, query.data.lng, loc.lat, loc.lng)
        )
      }

      return {
        id: loc.id,
        slug: loc.slug,
        name: loc.name,
        address: loc.address,
        lat: loc.lat,
        lng: loc.lng,
        allowOrders: loc.allowOrders,
        format: profile.format,
        posSystem: profile.posSystem,
        menuManagement: profile.menuManagement,
        paymentFlow: profile.paymentFlow,
        remoteOrderingEnabled: profile.remoteOrderingEnabled,
        googleMapsUrl: loc.googleMapsUrl,
        busyMode: loc.busyMode,
        busyModeUntil: loc.busyModeUntil,
        maxQueueSize: loc.maxQueueSize,
        hasPrinter: loc.hasPrinter,
        isOpen,
        nextOpenTime,
        distanceMeters,
        workingHours: loc.workingHours.map(h => ({
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          isClosed: h.isClosed,
        })),
      }
    })

    // Sort by distance if provided
    if (query.success && query.data.lat) {
      result.sort((a, b) => (a.distanceMeters || 99999) - (b.distanceMeters || 99999))
    }

    return reply.send({ success: true, locations: result })
  })

  // GET /api/locations/:slug
  app.get('/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string }

    const location = await prisma.location.findUnique({
      where: { slug, isActive: true },
      include: { workingHours: true },
    })

    if (!location) {
      return reply.status(404).send({ success: false, error: 'Location not found' })
    }

    const { isOpen, nextOpenTime } = isLocationOpen(location.workingHours)
    const profile = getLocationProfile(location)

    return reply.send({
      success: true,
      location: {
        ...location,
        posterToken: undefined, // never expose
        posterAccount: undefined,
        format: profile.format,
        posSystem: profile.posSystem,
        menuManagement: profile.menuManagement,
        paymentFlow: profile.paymentFlow,
        remoteOrderingEnabled: profile.remoteOrderingEnabled,
        isOpen,
        nextOpenTime,
      },
    })
  })
}
