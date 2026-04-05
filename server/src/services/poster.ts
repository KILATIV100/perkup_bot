import axios from 'axios';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const LOCATIONS = [
  {
    slug: 'krona',
    subdomain: process.env.POSTER_KRONA_SUBDOMAIN || 'perkup2',
    token: process.env.POSTER_KRONA_TOKEN || '',
  },
  {
    slug: 'pryozerny',
    subdomain: process.env.POSTER_PRYOZERNY_SUBDOMAIN || 'perkup',
    token: process.env.POSTER_PRYOZERNY_TOKEN || '',
  },
];

const CATEGORY_MAP: Record<string, string> = {
  'кава': 'coffee', 'coffee': 'coffee', 'кофе': 'coffee',
  'холодні': 'cold', 'cold': 'cold', 'смузі': 'cold', 'лимонад': 'cold',
  'їжа': 'food', 'food': 'food', 'випічка': 'food', 'снеки': 'food', 'десерт': 'food',
  'мерч': 'merch', 'зерно': 'beans', 'beans': 'beans',
};

function mapCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return val;
  }
  return 'coffee'; // default
}

export async function syncPosterMenu(locationSlug: string): Promise<{ synced: number; errors: string[] }> {
  const loc = LOCATIONS.find(l => l.slug === locationSlug);
  if (!loc || !loc.token) throw new Error(`No config for ${locationSlug}`);

  const location = await prisma.location.findUnique({ where: { slug: locationSlug } });
  if (!location) throw new Error(`Location not found: ${locationSlug}`);

  console.log(`[Poster] Syncing ${locationSlug}...`);

  const errors: string[] = [];
  let synced = 0;

  const url = `https://${loc.subdomain}.joinposter.com/api/menu.getProducts?token=${loc.token}&type=products`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Poster API ${res.status}: ${res.statusText}`);

  const data = await res.json() as any;
  if (!data.response) throw new Error(`Bad Poster response: ${JSON.stringify(data).slice(0, 200)}`);

  const products = Array.isArray(data.response)
    ? data.response
    : Object.values(data.response as Record<string, unknown>);

  console.log(`[Poster] ${products.length} products received for ${locationSlug}`);

  for (const item of products as any[]) {
    try {
      const price = parseFloat(item.product_price || '0') / 100;

      let imageUrl: string | undefined;
      if (item.photo && item.photo !== '0' && item.photo !== '') {
        imageUrl = String(item.photo).startsWith('http')
          ? item.photo
          : `https://${loc.subdomain}.joinposter.com${item.photo}`;
      }

      await prisma.product.upsert({
        // Schema has unique ([locationId, posterProductId]), so upsert key must use composite unique input.
        where: {
          locationId_posterProductId: {
            locationId: location.id,
            posterProductId: String(item.product_id),
          },
        },
        update: {
          name: item.product_name,
          price,
          category: mapCategory(item.category_name || ''),
          imageUrl,
          isAvailable: item.out !== 1,
          description: item.product_production_description || null,
        },
        create: {
          locationId: location.id,
          posterProductId: String(item.product_id),
          name: item.product_name,
          price,
          category: mapCategory(item.category_name || ''),
          imageUrl,
          isAvailable: item.out !== 1,
          description: item.product_production_description || null,
          allergens: [],
          tags: [],
        },
      });
      synced++;
    } catch (err: any) {
      errors.push(`${item.product_id}: ${err.message}`);
    }
  }

  await redis.del(`menu:${locationSlug}`);
  console.log(`[Poster] Synced ${synced}/${products.length} for ${locationSlug}`);
  return { synced, errors };
}

export async function syncAllLocations(): Promise<void> {
  for (const loc of LOCATIONS) {
    try {
      await syncPosterMenu(loc.slug);
    } catch (err: any) {
      console.error(`[Poster] Failed ${loc.slug}:`, err.message);
    }
  }

  const posterOrderId = response.data?.response?.incoming_order_id;
  if (!posterOrderId) {
    throw new Error('Poster response does not contain incoming_order_id');
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      posterOrderId: String(posterOrderId),
      status: 'SENT_TO_POS',
    },
  });

  return response.data.response;
}

export const createPosterClient = (token: string) => {
  return axios.create({
    baseURL: 'https://joinposter.com/api',
    params: { token },
  });
};

export async function createIncomingOrderInPoster(orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, user: true, location: true },
  });

  if (!order) throw new Error('Order not found');
  if (!order.location.hasPoster || !order.location.posterToken || !order.location.posterSpotId) {
    throw new Error('Location is not configured for Poster POS');
  }

  const posterApi = createPosterClient(order.location.posterToken);
  const products = order.items
    .filter((item) => !!item.productId)
    .map((item) => ({
      product_id: item.productId,
      count: item.quantity,
      price: Number(item.price),
    }));

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
  };

  const response = await posterApi.post('/incomingOrders.createIncomingOrder', payload);

  if (response.data?.error) {
    throw new Error(`Poster Error: ${response.data.error}`);
  }

  const posterOrderId = response.data?.response?.incoming_order_id;
  if (!posterOrderId) {
    throw new Error('Poster response does not contain incoming_order_id');
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      posterOrderId: String(posterOrderId),
      status: 'SENT_TO_POS',
    },
  });

  return response.data.response;
}
