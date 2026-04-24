import cron from 'node-cron'
import { prisma } from './lib/prisma'

const BOT_TOKEN = process.env.BOT_TOKEN || ''
const WINBACK_NOTIFICATIONS_ENABLED = process.env.FEATURE_NOTIF_WINBACK !== 'false'
const MORNING_NOTIFICATIONS_ENABLED = process.env.FEATURE_NOTIF_MORNING !== 'false'
const BIRTHDAY_NOTIFICATIONS_ENABLED = process.env.FEATURE_NOTIF_BIRTHDAY !== 'false'

function getKyivDayStart(date = new Date()): string {
  const kyiv = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }))
  const year = kyiv.getFullYear()
  const month = String(kyiv.getMonth() + 1).padStart(2, '0')
  const day = String(kyiv.getDate()).padStart(2, '0')
  return year + '-' + month + '-' + day
}

function getKyivParts(date = new Date()) {
  const kyiv = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Kyiv' }))
  return {
    year: kyiv.getFullYear(),
    month: kyiv.getMonth() + 1,
    day: kyiv.getDate(),
  }
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
  if (!WINBACK_NOTIFICATIONS_ENABLED) return
  const now = new Date()
  const olderThan = new Date(now.getTime() - daysSince * 86400000)
  const newerThan = new Date(now.getTime() - (daysSince + 1) * 86400000)

  const users = await prisma.user.findMany({
    where: {
      lastActivity: { lt: olderThan, gt: newerThan },
      notifWinback: true,
      isActive: true,
    },
    select: { telegramId: true, firstName: true, language: true },
    take: 1000,
  })

  for (const user of users) {
    const firstName = user.firstName || 'друже'
    const isUk = user.language !== 'en'
    let text = isUk
      ? `${firstName}, сумуємо за тобою ☕`
      : `${firstName}, we miss you ☕`
    if (daysSince === 7) {
      text = isUk
        ? 'Повернись за улюбленою кавою — сьогодні гарний день для PerkUp ✨'
        : 'Come back for your favorite coffee — today is a great PerkUp day ✨'
    }
    if (daysSince === 14) {
      text = isUk
        ? 'Давно не бачились. Завітай цього тижня на каву й гарний настрій 💛'
        : 'It has been a while. Drop by this week for coffee and good vibes 💛'
    }
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

async function runMorningNotification() {
  if (!MORNING_NOTIFICATIONS_ENABLED) return
  const users = await prisma.user.findMany({
    where: {
      notifMorning: true,
      isActive: true,
    },
    select: { telegramId: true, language: true, firstName: true },
    take: 1000,
  })

  for (const user of users) {
    const firstName = user.firstName || 'friend'
    const text = user.language === 'en'
      ? `Good morning, ${firstName}! Time for a fresh cup at PerkUp ☀️`
      : `Доброго ранку, ${firstName}! Час на свіжу каву в PerkUp ☀️`
    await sendTelegramMessage(user.telegramId, text)
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  console.log('[cron] morning reminders sent=' + users.length)
}

async function runBirthdayNotification() {
  if (!BIRTHDAY_NOTIFICATIONS_ENABLED) return
  const { day, month, year } = getKyivParts()
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      notifPromo: true,
      birthDate: { not: null },
      OR: [{ lastBirthdayBonus: null }, { lastBirthdayBonus: { lt: year } }],
    },
    select: { id: true, telegramId: true, birthDate: true, language: true, firstName: true },
    take: 1000,
  })

  let sent = 0
  for (const user of users) {
    const birthDate = user.birthDate ? new Date(user.birthDate) : null
    if (!birthDate) continue
    if (birthDate.getDate() !== day || birthDate.getMonth() + 1 !== month) continue

    const firstName = user.firstName || 'friend'
    const text = user.language === 'en'
      ? `Happy Birthday, ${firstName}! 🎉 Treat yourself to your favorite coffee today.`
      : `З днем народження, ${firstName}! 🎉 Потіш себе улюбленою кавою сьогодні.`
    await sendTelegramMessage(user.telegramId, text)
    await prisma.user.update({
      where: { id: user.id },
      data: { lastBirthdayBonus: year },
    })
    sent += 1
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  console.log('[cron] birthday reminders sent=' + sent + ' scanned=' + users.length)
}

export function startCronJobs() {
  cron.schedule('0 7 * * *', async () => { await runWinback(14) }, { timezone: 'Europe/Kyiv' })
  cron.schedule('10 7 * * *', async () => { await runWinback(7) }, { timezone: 'Europe/Kyiv' })
  cron.schedule('20 7 * * *', async () => { await runWinback(3) }, { timezone: 'Europe/Kyiv' })
  cron.schedule('0 9 * * *', async () => { await runMorningNotification() }, { timezone: 'Europe/Kyiv' })
  cron.schedule('30 9 * * *', async () => { await runBirthdayNotification() }, { timezone: 'Europe/Kyiv' })
  cron.schedule('0 17 * * *', async () => { await runSpinReminder() }, { timezone: 'Europe/Kyiv' })
  console.log('[cron] scheduled winback, morning, birthday and spin reminder jobs')
}
