import { Queue, Worker } from 'bullmq'
import { redis } from '../lib/redis'
import { prisma } from '../lib/prisma'

const connection = redis.duplicate({ maxRetriesPerRequest: null })

export const reminderQueue = new Queue('user-reminders', { connection })

function getKyivDateString(date = new Date()): string {
  const kyiv = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }))
  const y = kyiv.getFullYear()
  const m = String(kyiv.getMonth() + 1).padStart(2, '0')
  const d = String(kyiv.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function scheduleReminderJobs() {
  const jobs = await reminderQueue.getRepeatableJobs()
  for (const job of jobs) {
    await reminderQueue.removeRepeatableByKey(job.key)
  }

  await reminderQueue.add('spin-reminder-candidates', {}, {
    repeat: { every: 60 * 60 * 1000 },
    jobId: 'spin-reminder-candidates-hourly',
  })

  console.log('[Reminders] Scheduled hourly spin reminder scan')
}

export function startReminderWorker() {
  const worker = new Worker('user-reminders', async (job) => {
    if (job.name !== 'spin-reminder-candidates') return

    const today = getKyivDateString()
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        notifSpin: true,
        OR: [{ lastSpinDate: null }, { lastSpinDate: { not: today } }],
      },
      select: { id: true, telegramId: true },
      take: 500,
    })

    // Phase-5 readiness: producer is implemented.
    // Actual bot delivery will be connected in Phase 5 integration step.
    console.log(`[Reminders] spin candidates=${users.length} date=${today}`)
  }, { connection })

  worker.on('failed', (job, err) => {
    console.error(`[Reminders] Job ${job?.id} failed:`, err.message)
  })

  return worker
}
