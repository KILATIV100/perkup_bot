import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, ordersApi } from '../lib/api'
import { useCartStore } from '../stores/cart'
import { useLocationStore } from '../stores/location'
import { useAuthStore } from '../stores/auth'
import { useT } from '../lib/i18n'

const PHONE_STORAGE_KEY = 'perkup_customer_phone'

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { activeLocation } = useLocationStore()
  const { user, updateUser } = useAuthStore()
  const { items, clearCart } = useCartStore()
  const [customerPhone, setCustomerPhone] = useState(() => user?.phone || localStorage.getItem(PHONE_STORAGE_KEY) || '')
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const t = useT()

  const submit = async () => {
    if (!activeLocation) return setError(t('checkout.selectLocation'))
    if (!items.length) return setError(t('checkout.emptyCart'))
    if (activeLocation.posSystem === 'POSTER' && !customerPhone.trim()) {
      return setError(t('checkout.phoneRequired'))
    }

    setLoading(true)
    setError('')
    try {
      if (customerPhone.trim()) {
        localStorage.setItem(PHONE_STORAGE_KEY, customerPhone.trim())
      }
      const res = await ordersApi.create({
        locationId: activeLocation.id,
        customerPhone: customerPhone.trim() || undefined,
        comment: comment || undefined,
        items: items.map((i) => ({ productId: i.productId, bundleId: i.bundleId, quantity: i.quantity, modifiers: i.modifiers })),
      })

      if (activeLocation.posSystem === 'POSTER' && customerPhone.trim() && customerPhone.trim() !== (user?.phone || '')) {
        try {
          await authApi.updateSettings({ phone: customerPhone.trim() })
          updateUser({ phone: customerPhone.trim() })
        } catch {}
      }

      clearCart()
      navigate(`/orders/${res.data.orderId}`)
    } catch (e: any) {
      setError(e?.response?.data?.error || t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-coffee-700">{t('checkout.title')}</h1>

      {activeLocation?.posSystem === 'POSTER' && (
        <div>
          <label className="text-sm font-medium">{t('checkout.phone')}</label>
          <input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="mt-1 w-full border rounded-xl px-3 py-2"
            placeholder={t('checkout.phonePlaceholder')}
            inputMode="tel"
          />
          <div className="mt-1 text-xs text-gray-500">{t('checkout.phoneHint')}</div>
        </div>
      )}

      <div>
        <label className="text-sm font-medium">{t('checkout.comment')}</label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2" rows={3} placeholder={t('checkout.commentPlaceholder')} />
      </div>

      <div>
        <label className="text-sm font-medium">{t('checkout.payment')}</label>
        <div className="mt-2 rounded-2xl border border-coffee-200 bg-coffee-50 p-3 text-sm text-coffee-900">
          {t('checkout.cashierOnly')}
        </div>
      </div>

      {activeLocation?.posSystem === 'POSTER' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {t('checkout.posterBonus')}
        </div>
      )}

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button onClick={submit} disabled={loading} className="w-full px-4 py-3 rounded-2xl bg-coffee-700 text-white disabled:opacity-60">
        {loading ? t('checkout.submitting') : t('checkout.submit')}
      </button>
    </div>
  )
}
