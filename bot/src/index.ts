import 'dotenv/config'
import { Bot, InlineKeyboard } from 'grammy'

const BOT_TOKEN = process.env.BOT_TOKEN
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://perkup.com.ua'
const API_URL = process.env.API_URL || 'https://server-production-1a00.up.railway.app'

if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required')

export const bot = new Bot(BOT_TOKEN)

// ─── Google Place IDs ─────────────────────────────────────────────
const GOOGLE_REVIEWS: Record<string, { name: string; placeId: string }> = {
  krona:        { name: 'ЖК Крона Парк 2', placeId: 'ChIJ4__L5fvZ1EAREzeFlvBsfwU' },
  pryozerny:    { name: 'Парк Приозерний', placeId: 'ChIJ1z701b3b1EARawv0cxF8uTU' },
  'mark-mall':  { name: 'ТЦ Марк Молл',    placeId: 'ChIJ3Vs_2o7Z1EARHa_zimDUe1Y' },
}

function reviewUrl(placeId: string) {
  return `https://search.google.com/local/writereview?placeid=${placeId}`
}

// ─── Helpers ─────────────────────────────────────────────────────
function levelEmoji(level: string) {
  return ({ Bronze: '🥉', Silver: '🥈', Gold: '🥇', Platinum: '💎' } as any)[level] || '☕'
}

function progressBar(current: number, required: number) {
  const pct = Math.min(1, current / required)
  const filled = Math.round(pct * 10)
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${Math.round(pct * 100)}%`
}

const BOT_SECRET = process.env.BOT_SECRET || ''

async function fetchUserStatus(telegramId: number): Promise<any | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/bot/${telegramId}`, {
      headers: { 'x-bot-secret': BOT_SECRET },
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

async function fetchAuthToken(telegramId: number): Promise<string | null> {
  // Бот не може отримати JWT токен без initData від Telegram WebApp
  // Купівля спінів через бот вимагає відкрити застосунок для авторизації
  return null
}

// ─── Keyboards ────────────────────────────────────────────────────
function mainMenuKeyboard() {
  return new InlineKeyboard()
    .webApp('☕ Відкрити PerkUp', MINI_APP_URL).row()
    .text('🎡 Бонуси та спіни', 'menu:bonuses').text('👤 Профіль', 'menu:profile').row()
    .text('📍 Локації', 'menu:locations').text('👥 Запросити', 'menu:invite').row()
    .text('⭐ Залишити відгук', 'menu:reviews').text('❓ Допомога', 'menu:help')
}

function backMain() {
  return new InlineKeyboard().text('🏠 На головну', 'menu:main')
}

function profileKeyboard() {
  return new InlineKeyboard()
    .webApp('☕ Зробити замовлення', MINI_APP_URL).row()
    .webApp('🎡 Відкрити колесо', `${MINI_APP_URL}#/bonuses`).text('🏆 Всі рівні', 'menu:levels').row()
    .text('📋 Мої замовлення', 'menu:orders').text('🎁 Мої призи', 'menu:vouchers').row()
    .text('🏠 На головну', 'menu:main')
}

function bonusesKeyboard(spins: number, points: number) {
  const kb = new InlineKeyboard()
  if (spins > 0) {
    kb.webApp(`🎡 Крутити (${spins} ${spins === 1 ? 'спін' : 'спіни'})`, `${MINI_APP_URL}#/bonuses`).row()
  } else {
    kb.webApp('🎡 Відкрити колесо', `${MINI_APP_URL}#/bonuses`).row()
  }
  if (points >= 50)  kb.text('🛒 1 спін (50 балів)', 'buy:spin_1').row()
  if (points >= 120) kb.text('🛒 3 спіни (120 балів) 🔥', 'buy:spin_3').row()
  if (points >= 175) kb.text('🛒 5 спінів (175 балів) −30%', 'buy:spin_5').row()
  kb.text('← Профіль', 'menu:profile').text('🏠 На головну', 'menu:main')
  return kb
}

function locationsKeyboard() {
  return new InlineKeyboard()
    .text('📍 ЖК Крона Парк 2',  'loc:krona').row()
    .text('📍 Парк Приозерний',   'loc:pryozerny').row()
    .text('📍 ТЦ Марк Молл',      'loc:mark-mall').row()
    .text('🏠 На головну', 'menu:main')
}

function locationDetailKeyboard(slug: string, placeId: string, mapsUrl: string) {
  return new InlineKeyboard()
    .webApp('☕ Замовити тут', `${MINI_APP_URL}#/menu`).row()
    .url('🗺 Карта', mapsUrl).url('⭐ Залишити відгук', reviewUrl(placeId)).row()
    .text('← Локації', 'menu:locations').text('🏠 На головну', 'menu:main')
}

function reviewsKeyboard() {
  return new InlineKeyboard()
    .url('⭐ ЖК Крона Парк 2',  reviewUrl(GOOGLE_REVIEWS['krona'].placeId)).row()
    .url('⭐ Парк Приозерний',   reviewUrl(GOOGLE_REVIEWS['pryozerny'].placeId)).row()
    .url('⭐ ТЦ Марк Молл',      reviewUrl(GOOGLE_REVIEWS['mark-mall'].placeId)).row()
    .text('🏠 На головну', 'menu:main')
}

function inviteKeyboard(userId: number) {
  const link = `https://t.me/perkup_ua_bot?start=ref_${userId}`
  return new InlineKeyboard()
    .url('Поділитись посиланням', `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Приєднуйся до PerkUp — кава з балами! ☕')}`).row()
    .text('🏠 На головну', 'menu:main')
}

// ─── /start ───────────────────────────────────────────────────────
bot.command('start', async (ctx) => {
  const firstName = ctx.from?.first_name || 'друже'
  const ref = ctx.match || ''
  const refLine = ref.startsWith('ref_')
    ? `\n\n🎁 Тебе запросив друг! Після першого замовлення ви обоє отримаєте *+20 балів*.`
    : ''

  await ctx.reply(
    `Привіт, ${firstName}! ☕\n\n` +
    `Я — *Perky*, твій кавовий гід у Броварах.\n\n` +
    `Замовляй каву наперед, збирай бали і вигравай призи.` +
    `${refLine}\n\n` +
    `_Твій перший спін — безкоштовно! 🎡_`,
    { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() }
  )
})

// ─── Головне меню ─────────────────────────────────────────────────
bot.callbackQuery('menu:main', async (ctx) => {
  await ctx.answerCallbackQuery()
  const firstName = ctx.from?.first_name || 'друже'
  const status = await fetchUserStatus(ctx.from.id)
  const info = status ? `\n_Балів: ${status.points} · ${status.level} ${levelEmoji(status.level)}_` : ''

  await ctx.editMessageText(
    `Привіт, ${firstName}! ☕\n\nЩо хочеш зробити?${info}`,
    { parse_mode: 'Markdown', reply_markup: mainMenuKeyboard() }
  )
})

// ─── Профіль ─────────────────────────────────────────────────────
bot.callbackQuery('menu:profile', async (ctx) => {
  await ctx.answerCallbackQuery()
  const status = await fetchUserStatus(ctx.from.id)

  if (!status) {
    await ctx.editMessageText('👤 Профіль\n\nНе вдалось завантажити дані. Спробуй пізніше.', { reply_markup: backMain() })
    return
  }

  const { points, level, nextLevel, completedOrders, spinsAvailable } = status
  const progressLine = nextLevel
    ? `\n${progressBar(points, nextLevel.required)} до ${nextLevel.name}`
    : `\n💎 Максимальний рівень!`

  await ctx.editMessageText(
    `👤 *${ctx.from.first_name}*\n\n` +
    `${levelEmoji(level)} *${level}* · ${points} балів\n` +
    `Замовлень: ${completedOrders} · Спінів: ${spinsAvailable}${progressLine}`,
    { parse_mode: 'Markdown', reply_markup: profileKeyboard() }
  )
})

// ─── Бонуси ──────────────────────────────────────────────────────
bot.callbackQuery('menu:bonuses', async (ctx) => {
  await ctx.answerCallbackQuery()
  const status = await fetchUserStatus(ctx.from.id)

  const points = status?.points || 0
  const spins = status?.spinsAvailable || 0
  const completedOrders = status?.completedOrders || 0
  const toNext = 5 - (completedOrders % 5)

  const spinLine = spins > 0
    ? `Спінів доступно: *${spins}* — крути зараз! 🎉`
    : `Наступний спін через *${toNext}* замовл.`

  await ctx.editMessageText(
    `🎡 *Бонуси та спіни*\n\nБалів: *${points}*\n${spinLine}\n\n` +
    `_Купи спіни за бали:_\n1 спін = 50 · 3 спіни = 120 🔥 · 5 спінів = 175 (−30%)`,
    { parse_mode: 'Markdown', reply_markup: bonusesKeyboard(spins, points) }
  )
})

// ─── Купівля спінів ──────────────────────────────────────────────
bot.callbackQuery(/^buy:spin_(\d+)$/, async (ctx) => {
  const packageId = `spin_${ctx.match![1]}`
  await ctx.answerCallbackQuery('Обробляємо...')

  const token = await fetchAuthToken(ctx.from.id)
  if (!token) {
    await ctx.answerCallbackQuery({ text: 'Відкрий застосунок для авторизації', show_alert: true })
    return
  }

  try {
    const res = await fetch(`${API_URL}/api/loyalty/buy-spins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ packageId }),
    })
    const data = await res.json()
    if (!res.ok) {
      await ctx.answerCallbackQuery({ text: String(data.error || 'Помилка покупки'), show_alert: true })
      return
    }
    await ctx.editMessageText(
      `🎰 *${data.message}*\n\nСписано: ${data.pointsSpent} балів\nЗалишок: ${data.newBalance} балів`,
      { parse_mode: 'Markdown', reply_markup: new InlineKeyboard()
        .webApp('🎡 Крутити зараз!', `${MINI_APP_URL}#/bonuses`).row()
        .text('🏠 На головну', 'menu:main') }
    )
  } catch {
    await ctx.answerCallbackQuery({ text: 'Мережева помилка', show_alert: true })
  }
})

// ─── Локації ─────────────────────────────────────────────────────
bot.callbackQuery('menu:locations', async (ctx) => {
  await ctx.answerCallbackQuery()
  await ctx.editMessageText(
    `📍 *Наші кав'ярні*\n\nОбери локацію:`,
    { parse_mode: 'Markdown', reply_markup: locationsKeyboard() }
  )
})

bot.callbackQuery(/^loc:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery()
  const slug = ctx.match![1]

  const LOCS: Record<string, { addr: string; maps: string }> = {
    'krona':      { addr: 'вул. Чорновола 8В, Бровари (ЖК Крона Парк 2)', maps: 'https://www.google.com/maps/dir/?api=1&destination=50.51723,30.77948&travelmode=driving' },
    'pryozerny':  { addr: 'вул. Фіалківська 27А, Бровари (Парк Приозерний)', maps: 'https://www.google.com/maps/dir/?api=1&destination=50.50131,30.75401&travelmode=driving' },
    'mark-mall':  { addr: 'вул. Київська 239, Бровари (ТЦ Марк Молл)', maps: 'https://www.google.com/maps/dir/?api=1&destination=50.51482,30.78220&travelmode=driving' },
  }

  const loc = LOCS[slug]
  const review = GOOGLE_REVIEWS[slug]
  if (!loc || !review) return

  const nowKyiv = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kiev', hour: '2-digit', minute: '2-digit' })
  const [h] = nowKyiv.split(':').map(Number)
  const isOpen = h >= 8 && h < 21

  await ctx.editMessageText(
    `📍 *${review.name}*\n\n` +
    `${isOpen ? '🟢 Відкрито' : '🔴 Зачинено'} · 08:00–21:00\n${loc.addr}`,
    { parse_mode: 'Markdown', reply_markup: locationDetailKeyboard(slug, review.placeId, loc.maps) }
  )
})

// ─── Відгуки ─────────────────────────────────────────────────────
bot.callbackQuery('menu:reviews', async (ctx) => {
  await ctx.answerCallbackQuery()
  await ctx.editMessageText(
    `⭐ *Оціни нас у Google*\n\nТвій відгук допомагає нам рости і мотивує команду!\n\nОбери локацію:`,
    { parse_mode: 'Markdown', reply_markup: reviewsKeyboard() }
  )
})

// ─── Запросити ────────────────────────────────────────────────────
bot.callbackQuery('menu:invite', async (ctx) => {
  await ctx.answerCallbackQuery()
  const userId = ctx.from.id
  const link = `https://t.me/perkup_ua_bot?start=ref_${userId}`

  await ctx.editMessageText(
    `👥 *Запроси друга — отримай бали!*\n\nЗа кожного друга ви обоє отримаєте *+20 балів* після його першого замовлення.\n\nТвоє посилання:\n\`${link}\``,
    { parse_mode: 'Markdown', reply_markup: inviteKeyboard(userId) }
  )
})

// ─── Допомога ────────────────────────────────────────────────────
bot.callbackQuery('menu:help', async (ctx) => {
  await ctx.answerCallbackQuery()
  await ctx.editMessageText(
    `❓ *Як це працює*\n\n` +
    `*Бали:* 1 бал за кожні 10 грн\n\n` +
    `*Рівні:*\n🥉 Bronze — 0–299 · ×1.0\n🥈 Silver — 300–999 · ×1.1\n🥇 Gold — 1000–2999 · ×1.2\n💎 Platinum — 3000+ · ×1.3\n\n` +
    `*Спіни:* 1 безкоштовний кожні 5 замовлень\n\n` +
    `*Призи:* знижки, напої, стікери\n\n_Питання? Пиши нам!_`,
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard()
      .webApp('☕ Зробити замовлення', MINI_APP_URL).row()
      .text('🏠 На головну', 'menu:main') }
  )
})

// ─── Рівні ───────────────────────────────────────────────────────
bot.callbackQuery('menu:levels', async (ctx) => {
  await ctx.answerCallbackQuery()
  const status = await fetchUserStatus(ctx.from.id)
  const cur = status?.level || 'Bronze'
  const pts = status?.points || 0
  const mark = (lvl: string) => cur === lvl ? '▶ ' : '   '

  await ctx.editMessageText(
    `🏆 *Рівні лояльності*\n\n` +
    `${mark('Bronze')}🥉 *Bronze*   — 0–299 балів · ×1.0\n` +
    `${mark('Silver')}🥈 *Silver*   — 300–999 · ×1.1\n` +
    `${mark('Gold')}🥇 *Gold*     — 1000–2999 · ×1.2\n` +
    `${mark('Platinum')}💎 *Platinum* — 3000+ · ×1.3\n\n` +
    `Твій рівень: *${cur}* (${pts} балів)`,
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard()
      .text('← Профіль', 'menu:profile').text('🏠 На головну', 'menu:main') }
  )
})

// ─── Замовлення і призи ──────────────────────────────────────────
bot.callbackQuery('menu:orders', async (ctx) => {
  await ctx.answerCallbackQuery()
  await ctx.editMessageText('📋 *Мої замовлення*\n\nПереглянь повну історію в застосунку:', {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .webApp('📋 Відкрити', `${MINI_APP_URL}#/profile`).row()
      .text('← Профіль', 'menu:profile').text('🏠 На головну', 'menu:main'),
  })
})

bot.callbackQuery('menu:vouchers', async (ctx) => {
  await ctx.answerCallbackQuery()
  await ctx.editMessageText('🎁 *Мої призи та ваучери*\n\nПереглянь активні ваучери в застосунку:', {
    parse_mode: 'Markdown',
    reply_markup: new InlineKeyboard()
      .webApp('🎁 Відкрити', `${MINI_APP_URL}#/bonuses`).row()
      .text('← Профіль', 'menu:profile').text('🏠 На головну', 'menu:main'),
  })
})

// ─── Notification helpers (викликаються з сервера) ───────────────

export async function sendOrderCreated(telegramId: bigint, orderId: number, locationName: string, total: number, pointsToEarn: number) {
  await bot.api.sendMessage(Number(telegramId),
    `Відмінний вибір! ☕\n\nЗамовлення *#${orderId}* прийнято\n📍 ${locationName}\n\nДо оплати: *${total} грн*\n_+${pointsToEarn} балів після оплати_`,
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard()
      .webApp('📊 Статус', `${MINI_APP_URL}#/orders/${orderId}`).row()
      .text('🏠 На головну', 'menu:main') }
  )
}

export async function sendOrderReady(telegramId: bigint, orderId: number, locationName: string) {
  await bot.api.sendMessage(Number(telegramId),
    `☕ *Замовлення #${orderId} готове!*\n\nПідходь до ${locationName} — тебе чекає кава!`,
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard()
      .webApp('📊 Переглянути', `${MINI_APP_URL}#/orders/${orderId}`).row()
      .text('🏠 На головну', 'menu:main') }
  )
}

export async function sendPointsAwarded(telegramId: bigint, points: number, total: number, level: string, nextLevel: { name: string; required: number } | null, locationSlug: string) {
  const progress = nextLevel
    ? `\n${progressBar(total, nextLevel.required)} до ${nextLevel.name}`
    : `\n💎 Максимальний рівень!`

  const placeId = GOOGLE_REVIEWS[locationSlug]?.placeId || GOOGLE_REVIEWS['krona'].placeId

  await bot.api.sendMessage(Number(telegramId),
    `+${points} балів на рахунку! ⭐\n\nВсього: *${total} балів* · ${levelEmoji(level)} ${level}${progress}`,
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard()
      .webApp('🎡 Крутити колесо', `${MINI_APP_URL}#/bonuses`)
      .webApp('☕ Ще кави', MINI_APP_URL).row()
      .url('⭐ Залишити відгук', reviewUrl(placeId)) }
  )
}

export async function sendOrderCancelled(telegramId: bigint, orderId: number) {
  await bot.api.sendMessage(Number(telegramId),
    `❌ Замовлення *#${orderId}* скасовано.\nЯкщо є питання — напишіть нам.`,
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard()
      .webApp('☕ Замовити знову', MINI_APP_URL).row()
      .text('🏠 На головну', 'menu:main') }
  )
}

export async function sendLevelUp(telegramId: bigint, firstName: string, newLevel: string) {
  const perks: Record<string, string> = {
    Silver:   'Множник балів ×1.1 — кожне замовлення вигідніше!',
    Gold:     'Множник балів ×1.2 — ти в еліті PerkUp!',
    Platinum: 'Множник балів ×1.3 — максимальний рівень! Ти легенда ☕',
  }
  await bot.api.sendMessage(Number(telegramId),
    `Ти тепер *${newLevel}*! ${levelEmoji(newLevel)}\n\nВітаємо, ${firstName}!\n${perks[newLevel] || ''}`,
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard()
      .webApp('☕ Відкрити PerkUp', MINI_APP_URL).row()
      .text('🏠 На головну', 'menu:main') }
  )
}

export async function sendSpinReminder(telegramId: bigint) {
  const variants = [
    `🎡 Твій безкоштовний спін чекає! Згорає о 23:59.`,
    `🎡 Спін згорає о 23:59 — не пропусти.`,
    `Сьогодні ще є шанс виграти каву. Крути зараз ☕`,
    `🎡 Крути.`,
    `Perky каже: час крутити! Твій спін чекає ☕`,
  ]
  await bot.api.sendMessage(Number(telegramId),
    variants[Math.floor(Math.random() * variants.length)],
    { reply_markup: new InlineKeyboard().webApp('🎡 Крутити зараз', `${MINI_APP_URL}#/bonuses`) }
  )
}

export async function sendWinback(telegramId: bigint, firstName: string, daysSince: number) {
  const msgs: Record<number, string> = {
    3:  `${firstName}, давно не бачились! ☕ Кава чекає.`,
    7:  `Повертайся — наступне замовлення з *подвійними балами*! Тільки 48 год. ⏰`,
    14: `🎁 Ми сумували! Безкоштовний напій чекає. Забери до кінця тижня.`,
  }
  await bot.api.sendMessage(Number(telegramId),
    msgs[daysSince] || msgs[7],
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard()
      .webApp('☕ Замовити зараз', MINI_APP_URL).row()
      .text('🏠 На головну', 'menu:main') }
  )
}

export async function sendBirthdayGreeting(telegramId: bigint, firstName: string, voucherCode: string) {
  await bot.api.sendMessage(Number(telegramId),
    `🎂 *З Днем народження, ${firstName}!*\n\n` +
    `PerkUp дарує тобі:\n☕ Безкоштовний напій · код: \`${voucherCode}\`\n🎡 3 безкоштовні спіни\n⭐ Подвійні бали весь день\n\n_Дійсно до кінця сьогодні 🎉_`,
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard()
      .webApp('🎂 Отримати подарунок', `${MINI_APP_URL}#/bonuses`).row()
      .text('🏠 На головну', 'menu:main') }
  )
}

export async function sendNoActiveShift(ownerTelegramId: bigint, locationName: string) {
  await bot.api.sendMessage(Number(ownerTelegramId),
    `⚠️ *Увага!*\n\nНадійшло замовлення у *${locationName}*, але немає активної зміни!\n\nПеревір чи бариста розпочав зміну.`,
    { parse_mode: 'Markdown' }
  )
}

// ─── Broadcast (власник) ─────────────────────────────────────────
const OWNER_ID = Number(process.env.OWNER_TELEGRAM_ID || '7363233852')
const pendingBroadcast: { filter?: string; text?: string } = {}

bot.command('broadcast', async (ctx) => {
  if (ctx.from?.id !== OWNER_ID) return
  await ctx.reply('Кому надіслати розсилку?', {
    reply_markup: new InlineKeyboard()
      .text('Всім', 'bc:all').row()
      .text('Silver і вище', 'bc:silver').row()
      .text('Gold і вище', 'bc:gold').row()
      .text('Скасувати', 'bc:cancel'),
  })
})

bot.callbackQuery(/^bc:(all|silver|gold|cancel)$/, async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return
  await ctx.answerCallbackQuery()
  const filter = ctx.match![1]
  if (filter === 'cancel') { await ctx.editMessageText('Скасовано.'); return }
  pendingBroadcast.filter = filter
  const labels: Record<string, string> = { all: 'всіх', silver: 'Silver+', gold: 'Gold+' }
  await ctx.editMessageText(`Розсилка для *${labels[filter]}*.\n\nВведи текст повідомлення:`, { parse_mode: 'Markdown' })
})

bot.callbackQuery(/^bcsend:(.+)$/, async (ctx) => {
  if (ctx.from.id !== OWNER_ID) return
  await ctx.answerCallbackQuery('Надсилаємо...')
  const text = pendingBroadcast.text
  const filter = ctx.match![1]
  pendingBroadcast.text = undefined
  if (!text) { await ctx.editMessageText('Помилка: текст не знайдено.'); return }
  try {
    const res = await fetch(`${API_URL}/api/admin/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter, text }),
    })
    const data = await res.json()
    await ctx.editMessageText(`✅ Надіслано! Отримувачів: ${data.sent || '?'}`)
  } catch {
    await ctx.editMessageText('❌ Помилка надсилання.')
  }
})

bot.on('message:text', async (ctx) => {
  if (ctx.from?.id !== OWNER_ID || !pendingBroadcast.filter) return
  const text = ctx.message.text
  pendingBroadcast.text = text
  const filter = pendingBroadcast.filter
  pendingBroadcast.filter = undefined
  await ctx.reply(
    `*Попередній перегляд:*\n\n${text}\n\nНадіслати?`,
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard()
      .text('Так, надіслати', `bcsend:${filter}`).text('Скасувати', 'bc:cancel') }
  )
})

// ─── Set commands ─────────────────────────────────────────────────
async function setBotCommands() {
  await bot.api.setMyCommands([
    { command: 'start', description: '☕ Головне меню PerkUp' },
  ])
  await bot.api.setChatMenuButton({
    menu_button: { type: 'web_app', text: '☕ PerkUp', web_app: { url: MINI_APP_URL } },
  })
  console.log('✅ Bot commands set')
}

// ─── Start ────────────────────────────────────────────────────────
async function startBot() {
  await setBotCommands()
  console.log('🤖 PerkUp Bot starting...')
  bot.start({ onStart: (info) => console.log(`✅ Bot @${info.username} is running`) })
}

startBot().catch(console.error)
