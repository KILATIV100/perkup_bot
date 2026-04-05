import Redis from 'ioredis';

// Single Redis instance for the whole server process.
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => Math.min(times * 100, 3000),
  lazyConnect: true,
});

redis.on('error', (err) => {
  console.error('[Redis] Error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected successfully');
});

// Helper: set with expiry in seconds
export const setEx = async (key: string, seconds: number, value: string) => {
  return redis.set(key, value, 'EX', seconds);
};

export const acquireLock = async (key: string, ttlSeconds: number): Promise<boolean> => {
  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
};

export const releaseLock = async (key: string) => {
  return redis.del(key);
};
