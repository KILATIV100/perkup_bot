import crypto from 'crypto'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

export interface TelegramInitData {
  user: TelegramUser
  auth_date: number
  hash: string
  start_param?: string
}

/**
 * Verify Telegram WebApp initData
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramInitData(initDataRaw: string): TelegramInitData {
  const botToken = process.env.BOT_TOKEN
  if (!botToken) throw new Error('BOT_TOKEN not configured')

  const params = new URLSearchParams(initDataRaw)
  const hash = params.get('hash')
  if (!hash) throw new Error('Missing hash in initData')

  // Build data-check-string (sorted, excluding hash)
  params.delete('hash')
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  // Compute HMAC-SHA256
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest()

  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  if (computedHash !== hash) {
    throw new Error('Invalid initData signature')
  }

  // Check auth_date (not older than 24 hours)
  const authDate = parseInt(params.get('auth_date') || '0')
  const now = Math.floor(Date.now() / 1000)
  if (now - authDate > 86400) {
    throw new Error('initData expired')
  }

  // Parse user
  const userJson = params.get('user')
  if (!userJson) throw new Error('Missing user in initData')
  const user: TelegramUser = JSON.parse(userJson)

  return {
    user,
    auth_date: authDate,
    hash,
    start_param: params.get('start_param') || undefined,
  }
}

/**
 * Generate JWT payload from Telegram user
 */
export function buildJwtPayload(userId: number, role: string) {
  return { id: userId, role }
}
