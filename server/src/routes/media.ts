import { FastifyInstance } from 'fastify'
import { redis } from '../lib/redis'

const FILE_PATH_TTL = 82800 // 23 hours

export default async function mediaRoutes(app: FastifyInstance) {

  // GET /api/media/:fileId
  // Proxies Telegram file - client never sees BOT_TOKEN
  app.get('/:fileId', async (req, reply) => {
    const { fileId } = req.params as { fileId: string }
    const botToken = process.env.BOT_TOKEN

    if (!botToken) {
      return reply.status(500).send({ error: 'Bot not configured' })
    }

    try {
      // Check Redis cache for file_path
      const cacheKey = `tg:file:${fileId}`
      let fileUrl = await redis.get(cacheKey)

      if (!fileUrl) {
        // Get file_path from Telegram
        const res = await fetch(
          `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
        )
        const data = await res.json() as any

        if (!data.ok || !data.result?.file_path) {
          return reply.status(404).send({ error: 'File not found' })
        }

        fileUrl = `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`
        await redis.set(cacheKey, fileUrl, 'EX', FILE_PATH_TTL)
      }

      // Stream file from Telegram
      const fileRes = await fetch(fileUrl)
      if (!fileRes.ok) {
        return reply.status(404).send({ error: 'File unavailable' })
      }

      const contentType = fileRes.headers.get('content-type') || 'application/octet-stream'
      reply.header('Content-Type', contentType)
      reply.header('Cache-Control', 'public, max-age=86400')

      return reply.send(Buffer.from(await fileRes.arrayBuffer()))
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'Media unavailable' })
    }
  })
}
