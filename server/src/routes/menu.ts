import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis'; // Використовуємо redis замість redisCache
import { getLocationProfile } from '../lib/locationProfile';
import { buildMenuQrSvg, buildPrintableMenuHtml, groupProductsByCategory, sortMenuProducts } from '../lib/menuPresentation';

const MENU_CACHE_TTL = 1800; // 30 хвилин

function getBaseUrl(req: any) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const protocol = forwardedProto || req.protocol || 'https'
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
  return `${protocol}://${host}`
}

export default async function menuRoutes(app: FastifyInstance) {

  // GET /api/menu/:locationSlug
  app.get('/:locationSlug', async (req, reply) => {
    const { locationSlug } = req.params as { locationSlug: string };
    const query = z.object({
      category: z.string().optional(),
      search: z.string().optional(),
      tags: z.string().optional(), // comma-separated: "vegan,no-lactose"
    }).safeParse(req.query);

    const location = await prisma.location.findUnique({
      where: { slug: locationSlug, isActive: true },
    });
    
    if (!location) {
      return reply.status(404).send({ success: false, error: 'Location not found' });
    }

    const profile = getLocationProfile(location)

    const cacheKey = `menu:${locationSlug}`;

    // Try cache first
    let products: any[];
    let bundles: any[];

    const cached = await redis.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      products = data.products;
      bundles = data.bundles;
    } else {
      products = await prisma.product.findMany({
        where: { locationId: location.id, isAvailable: true },
        orderBy: [{ categoryOrder: 'asc' }, { category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      });
      bundles = await prisma.bundle.findMany({
        where: { locationId: location.id, isAvailable: true },
        include: {
          items: {
            include: { product: { select: { id: true, name: true } } },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });

      // Cache it
      await redis.set(cacheKey, JSON.stringify({ products, bundles }), 'EX', MENU_CACHE_TTL);
    }

    // Apply filters
    let filtered = sortMenuProducts(products);

    if (query.success) {
      if (query.data.category) {
        filtered = filtered.filter(p => p.category === query.data.category);
      }
      if (query.data.search) {
        const s = query.data.search.toLowerCase();
        filtered = filtered.filter(p =>
          p.name.toLowerCase().includes(s) ||
          (p.description && p.description.toLowerCase().includes(s))
        );
      }
      if (query.data.tags) {
        const tagList = query.data.tags.split(',');
        filtered = filtered.filter(p =>
          tagList.every((tag: string) => p.tags && (p.tags as string[]).includes(tag))
        );
      }
    }

    // Group by category
    const grouped = groupProductsByCategory(filtered).map((group) => ({
      category: group.category,
      label: group.label,
      products: group.products,
    }))

    // Popular products (top 3 by ordersCount)
    const popular = [...products]
      .sort((a, b) => (b.ordersCount || 0) - (a.ordersCount || 0))
      .slice(0, 3);

    return reply.send({
      success: true,
      locationId: location.id,
      locationSlug,
      allowOrders: location.allowOrders,
      format: profile.format,
      posSystem: profile.posSystem,
      menuManagement: profile.menuManagement,
      paymentFlow: profile.paymentFlow,
      remoteOrderingEnabled: profile.remoteOrderingEnabled,
      popular,
      categories: grouped,
      bundles,
    });
  });

  app.get('/:locationSlug/qr.svg', async (req, reply) => {
    const { locationSlug } = req.params as { locationSlug: string }

    const location = await prisma.location.findUnique({ where: { slug: locationSlug, isActive: true } })
    if (!location) {
      return reply.status(404).send({ success: false, error: 'Location not found' })
    }

    const targetUrl = `${getBaseUrl(req)}/api/menu/${encodeURIComponent(locationSlug)}/print`
    const svg = await buildMenuQrSvg({
      locationName: location.name,
      locationSlug: location.slug,
      subtitle: location.address,
      targetUrl,
    })

    reply.header('Content-Type', 'image/svg+xml; charset=utf-8')
    reply.header('Content-Disposition', `inline; filename="${location.slug}-menu-qr.svg"`)
    return reply.send(svg)
  })

  app.get('/:locationSlug/print', async (req, reply) => {
    const { locationSlug } = req.params as { locationSlug: string }

    const location = await prisma.location.findUnique({ where: { slug: locationSlug, isActive: true } })
    if (!location) {
      return reply.status(404).send({ success: false, error: 'Location not found' })
    }

    const [products, bundles] = await Promise.all([
      prisma.product.findMany({
        where: { locationId: location.id, isAvailable: true },
        orderBy: [{ categoryOrder: 'asc' }, { category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.bundle.findMany({
        where: { locationId: location.id, isAvailable: true },
        include: {
          items: {
            include: { product: { select: { name: true } } },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    ])

    const profile = getLocationProfile(location)
    const html = await buildPrintableMenuHtml({
      baseUrl: getBaseUrl(req),
      location: {
        slug: location.slug,
        name: location.name,
        address: location.address,
        allowOrders: location.allowOrders,
      },
      profile,
      products,
      bundles,
    })

    reply.header('Content-Type', 'text/html; charset=utf-8')
    return reply.send(html)
  })

  // GET /api/menu/:locationSlug/categories
  app.get('/:locationSlug/categories', async (req, reply) => {
    const { locationSlug } = req.params as { locationSlug: string };

    const location = await prisma.location.findUnique({
      where: { slug: locationSlug, isActive: true },
    });
    
    if (!location) {
      return reply.status(404).send({ success: false, error: 'Location not found' });
    }

    const products = await prisma.product.findMany({
      where: { locationId: location.id, isAvailable: true },
      select: { category: true, categoryOrder: true, sortOrder: true, name: true },
      orderBy: [{ categoryOrder: 'asc' }, { category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    })

    return reply.send({
      success: true,
      categories: groupProductsByCategory(products as any).map((group) => group.category),
    });
  });
}
