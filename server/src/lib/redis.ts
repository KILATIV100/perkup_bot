import Redis from 'ioredis'

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  retryStrategy: (times: number) => Math.min(times * 100, 3000),
  lazyConnect: true,
})

export const redisCache = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 100, 3000),
  lazyConnect: true,
})

redis.on('error', (err: Error) => console.error('Redis error:', err.message))
redis.on('connect', () => console.log('Redis connected'))
redisCache.on('error', (err: Error) => console.error('RedisCache error:', err.message))

export const setEx = async (key: string, seconds: number, value: string) => {
  return redisCache.set(key, value, 'EX', seconds)
}

export const acquireLock = async (key: string, ttlSeconds: number): Promise<boolean> => {
  const result = await redisCache.set(key, '1', 'EX', ttlSeconds, 'NX')
  return result === 'OK'
}

export const releaseLock = async (key: string) => {
  return redisCache.del(key)
}
