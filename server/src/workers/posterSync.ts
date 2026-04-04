import { Queue, Worker } from 'bullmq'
import { redis } from '../lib/redis'
import { syncAllLocations } from '../services/poster'

const connection = redis

export const posterSyncQueue = new Queue('poster-sync', { connection })

export async function schedulePosterSync() {
  const jobs = await posterSyncQueue.getRepeatableJobs()
  for (const job of jobs) {
    await posterSyncQueue.removeRepeatableByKey(job.key)
  }
  await posterSyncQueue.add('sync-all', {}, {
    repeat: { every: 30 * 60 * 1000 },
    jobId: 'poster-sync-all',
  })
  console.log('[PosterSync] Scheduled every 30 minutes')
}

export function startPosterSyncWorker() {
  const worker = new Worker('poster-sync', async (job) => {
    console.log('[PosterSync] Running job: ' + job.name)
    await syncAllLocations()
  }, { connection })
  worker.on('completed', (job) => console.log('[PosterSync] Job ' + job.id + ' completed'))
  worker.on('failed', (job, err) => console.error('[PosterSync] Job ' + job?.id + ' failed:', err.message))
  return worker
}
