export function normalizePhone(phone: string): string | null {
  const digits = phone.replace(/[^\d]/g, '')
  if (!digits) return null

  if (digits.length === 10 && digits.startsWith('0')) {
    return '+38' + digits
  }
  if (digits.length === 12 && digits.startsWith('380')) {
    return '+' + digits
  }
  if (digits.length === 13 && digits.startsWith('380')) {
    return '+' + digits.slice(1)
  }
  return null
}

export function normalizePhoneOrThrow(phone: string): string {
  const normalized = normalizePhone(phone)
  if (!normalized) {
    throw new Error('Invalid phone number format')
  }
  return normalized
}
