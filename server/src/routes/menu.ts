import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis'; // Використовуємо redis замість redisCache

const MENU_CACHE_TTL = 1800; // 30 хвилин

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
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
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
    let filtered = [...products];

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
    const categories = [...new Set(filtered.map(p => p.category))];
    const grouped = categories.map(cat => ({
      category: cat,
      products: filtered.filter(p => p.category === cat),
    }));

    // Popular products (top 3 by ordersCount)
    const popular = [...products]
      .sort((a, b) => (b.ordersCount || 0) - (a.ordersCount || 0))
      .slice(0, 3);

    return reply.send({
      success: true,
      locationId: location.id,
      locationSlug,
      allowOrders: location.allowOrders,
      popular,
      categories: grouped,
      bundles,
    });
  });

  // GET /api/menu/:locationSlug/categories
  app.get('/:locationSlug/categories', async (req, reply) => {
    const { locationSlug } = req.params as { locationSlug: string };

    const location = await prisma.location.findUnique({
      where: { slug: locationSlug, isActive: true },
    });
    
    if (!location) {
      return reply.status(404).send({ success: false, error: 'Location not found' });
    }

    const categories = await prisma.product.findMany({
      where: { locationId: location.id, isAvailable: true },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    return reply.send({
      success: true,
      categories: categories.map(c => c.category),
    });
  });
}
