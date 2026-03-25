import 'dotenv/config'
import { Bot, InlineKeyboard, webhookCallback } from 'grammy'

const BOT_TOKEN = process.env.BOT_TOKEN
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://perkup.com.ua'

if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required')

export const bot = new Bot(BOT_TOKEN)

// ─── /start command ───────────────────────────────────────────────
bot.command('start', async (ctx) => {
  const firstName = ctx.from?.first_name || 'друже'
  const startParam = ctx.match // ref_123 or empty

  const keyboard = new InlineKeyboard()
    .webApp('☕ Відкрити PerkUp', MINI_APP_URL)

  await ctx.reply(
    `Привіт, ${firstName}! ☕\n\n` +
    `Ласкаво просимо до *PerkUp* — твоєї кав'ярні в Telegram!\n\n` +
    `🎡 Крути колесо та збирай бали\n` +
    `📱 Замовляй каву заздалегідь\n` +
    `🎮 Грай в ігри та вигравай призи\n` +
    `📻 Слухай PerkUp Radio\n\n` +
    `Натисни кнопку нижче щоб розпочати 👇`,
    {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    }
  )
})

// ─── /menu command ────────────────────────────────────────────────
bot.command('menu', async (ctx) => {
  const keyboard = new InlineKeyboard()
    .webApp('☕ Відкрити меню', `${MINI_APP_URL}?page=menu`)

  await ctx.reply('Переглянь наше меню 👇', { reply_markup: keyboard })
})

// ─── /profile command ─────────────────────────────────────────────
bot.command('profile', async (ctx) => {
  const keyboard = new InlineKeyboard()
    .webApp('👤 Мій профіль', `${MINI_APP_URL}?page=profile`)

  await ctx.reply('Твій профіль та баланс 👇', { reply_markup: keyboard })
})

// ─── /help command ────────────────────────────────────────────────
bot.command('help', async (ctx) => {
  await ctx.reply(
    `*PerkUp — довідка* ☕\n\n` +
    `*/start* — відкрити додаток\n` +
    `*/menu* — переглянути меню\n` +
    `*/profile* — мій профіль та бали\n\n` +
    `*Як накопичити бали?*\n` +
    `• Крути Колесо Фортуни щодня (+5/+10/+15 балів)\n` +
    `• Замовляй каву (+1 бал за кожні 10 грн)\n` +
    `• Запрошуй друзів (+10 балів)\n` +
    `• Грай в ігри (+2-5 балів)\n\n` +
    `*Як витратити бали?*\n` +
    `100 балів = 1 безкоштовний напій до 100 грн 🎁`,
    { parse_mode: 'Markdown' }
  )
})

// ─── Notification helpers (called from server) ────────────────────

export async function sendOrderAccepted(telegramId: bigint, orderNum: number, eta: string) {
  await bot.api.sendMessage(
    Number(telegramId),
    `✅ *Замовлення #${orderNum} прийнято!*\n\nЧекай — буде готово о *${eta}* ☕`,
    { parse_mode: 'Markdown' }
  )
}

export async function sendOrderReady(telegramId: bigint, orderNum: number, qrCode: string) {
  await bot.api.sendMessage(
    Number(telegramId),
    `☕ *Твоя кава готова!*\n\nЗамовлення *#${orderNum}* — покажи QR-код баристі 👇`,
    { parse_mode: 'Markdown' }
  )
}

export async function sendOrderCancelled(telegramId: bigint, orderNum: number) {
  await bot.api.sendMessage(
    Number(telegramId),
    `❌ *Замовлення #${orderNum} скасовано*\n\nКошти буде повернено протягом 1-3 робочих днів.`,
    { parse_mode: 'Markdown' }
  )
}

export async function sendReviewRequest(telegramId: bigint, orderId: number) {
  const keyboard = new InlineKeyboard()
    .webApp('⭐ Залишити відгук', `${MINI_APP_URL}?page=review&orderId=${orderId}`)

  await bot.api.sendMessage(
    Number(telegramId),
    `Як тобі кава? ☕\n\nБудемо вдячні за відгук — це займе 10 секунд 🙏`,
    { reply_markup: keyboard }
  )
}

export async function sendSpinReminder(telegramId: bigint) {
  const keyboard = new InlineKeyboard()
    .webApp('🎡 Крутити зараз', `${MINI_APP_URL}?page=wheel`)

  await bot.api.sendMessage(
    Number(telegramId),
    `🎡 Ти ще не крутив Колесо сьогодні!\n\nБезкоштовний спін згорає о *півночі* — не пропусти 🔥`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  )
}

export async function sendWinback(telegramId: bigint, firstName: string) {
  const keyboard = new InlineKeyboard()
    .webApp('☕ Замовити зараз', `${MINI_APP_URL}?page=menu`)

  await bot.api.sendMessage(
    Number(telegramId),
    `${firstName}, скучили за тобою! ☕\n\nТвоє наступне замовлення — *подвійні бали* 🎁`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  )
}

export async function sendBirthdayGreeting(telegramId: bigint, firstName: string, code: string) {
  const keyboard = new InlineKeyboard()
    .webApp('🎂 Отримати подарунок', `${MINI_APP_URL}?page=profile`)

  await bot.api.sendMessage(
    Number(telegramId),
    `🎂 *З Днем народження, ${firstName}!*\n\n` +
    `PerkUp дарує тобі:\n` +
    `☕ Безкоштовний напій: код *${code}*\n` +
    `🎡 3 безкоштовні спіни\n` +
    `⭐ Подвійні бали весь день\n\n` +
    `Коди дійсні до кінця дня 🎉`,
    { parse_mode: 'Markdown', reply_markup: keyboard }
  )
}

export async function sendNoActiveShift(ownerTelegramId: bigint, locationName: string) {
  await bot.api.sendMessage(
    Number(ownerTelegramId),
    `⚠️ *Увага!*\n\nНадійшло замовлення у *${locationName}*, але немає активної зміни!\n\nПеревір чи бариста розпочав зміну.`,
    { parse_mode: 'Markdown' }
  )
}

// ─── Set bot commands ──────────────────────────────────────────────
async function setBotCommands() {
  await bot.api.setMyCommands([
    { command: 'start', description: '☕ Відкрити PerkUp' },
    { command: 'menu', description: '📋 Переглянути меню' },
    { command: 'profile', description: '👤 Мій профіль та бали' },
    { command: 'help', description: '❓ Довідка' },
  ])

  // Set Mini App button
  await bot.api.setChatMenuButton({
    menu_button: {
      type: 'web_app',
      text: '☕ PerkUp',
      web_app: { url: MINI_APP_URL },
    },
  })

  console.log('✅ Bot commands set')
}

// ─── Start ────────────────────────────────────────────────────────
async function startBot() {
  await setBotCommands()
  console.log('🤖 PerkUp Bot starting...')
  bot.start({
    onStart: (info) => console.log(`✅ Bot @${info.username} is running`),
  })
}

startBot().catch(console.error)
