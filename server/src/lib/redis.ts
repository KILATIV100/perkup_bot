import Redis from 'ioredis'

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  lazyConnect: true,
})

redis.on('error', (err) => {
  console.error('Redis error:', err.message)
})

redis.on('connect', () => {
  console.log('Redis connected')
})

// Helper: set with expiry in seconds
export const setEx = (key: string, seconds: number, value: string) =>
  redis.set(key, value, 'EX', seconds)

// Helper: atomic lock (for race condition protection)
export const acquireLock = async (key: string, ttlSeconds: number): Promise<boolean> => {
  const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX')
  return result === 'OK'
}

export const releaseLock = (key: string) => redis.del(key)
