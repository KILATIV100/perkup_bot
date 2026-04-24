import cron from 'node-cron'
import { prisma } from './lib/prisma'

const BOT_TOKEN = process.env.BOT_TOKEN || ''

function getKyivDayStart(date = new Date()): string {
  const kyiv = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }))
  const year = kyiv.getFullYear()
  const month = String(kyiv.getMonth() + 1).padStart(2, '0')
  const day = String(kyiv.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

async function sendTelegramMessage(telegramId: bigint, text: string) {
  if (!BOT_TOKEN) return
  try {
    await fetch('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: Number(telegramId),
        text,
        parse_mode: 'Markdown',
      }),
    })
  } catch (error) {
    console.error('[cron] telegram send failed:', (error as Error).message)
  }
}

async function runWinback(daysSince: number) {
  const now = new Date()
  const olderThan = new Date(now.getTime() - daysSince * 86400000)
  const newerThan = new Date(now.getTime() - (daysSince + 1) * 86400000)

  const users = await prisma.user.findMany({
    where: {
      lastActivity: { lt: olderThan, gt: newerThan },
      notifWinback: true,
      isActive: true,
    },
    select: { telegramId: true, firstName: true },
    take: 1000,
  })

  for (const user of users) {
    const firstName = user.firstName || 'friend'
    let text = firstName + ', we miss you. Your coffee is waiting.'
    if (daysSince === 7) text = 'Come back for a fresh coffee and extra value today.'
    if (daysSince === 14) text = 'We miss you. Come back this week for a pleasant surprise.'
    await sendTelegramMessage(user.telegramId, text)
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  console.log('[cron] winback days=' + daysSince + ' users=' + users.length)
}

async function runSpinReminder() {
  const today = getKyivDayStart()
  const users = await prisma.user.findMany({
    where: {
      notifSpin: true,
      isActive: true,
      OR: [{ lastSpinDate: null }, { lastSpinDate: { not: today } }],
    },
    select: { id: true, telegramId: true },
    take: 1000,
  })

  let sent = 0
  for (const user of users) {
    const completedOrders = await prisma.order.count({
      where: { userId: user.id, status: 'COMPLETED' },
    })
    const usedSpins = await prisma.spinResult.count({
      where: { userId: user.id },
    })
    const availableSpins = Math.max(0, Math.floor(completedOrders / 5) - usedSpins)
    if (availableSpins <= 0) continue

    await sendTelegramMessage(user.telegramId, '\uD83C\uDFB2 Your free spin is waiting. Open PerkUp and spin today.')
    sent += 1
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  console.log('[cron] spin reminders sent=' + sent + ' scanned=' + users.length)
}

export function startCronJobs() {
  cron.schedule('0 7 * * *', async () => { await runWinback(14) }, { timezone: 'Europe/Kyiv' })
  cron.schedule('10 7 * * *', async () => { await runWinback(7) }, { timezone: 'Europe/Kyiv' })
  cron.schedule('20 7 * * *', async () => { await runWinback(3) }, { timezone: 'Europe/Kyiv' })
  cron.schedule('0 17 * * *', async () => { await runSpinReminder() }, { timezone: 'Europe/Kyiv' })
  console.log('[cron] scheduled winback and spin reminder jobs')
}
