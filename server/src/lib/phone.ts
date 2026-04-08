export function normalizePhone(phone: string): string {
  const normalized = phone.replace(/[^\d+]/g, '')
  if (!/^\+?[\d]{10,15}$/.test(normalized)) {
    throw new Error('Invalid phone number format')
  }
  return normalized.startsWith('+') ? normalized : `+${normalized}`
}
