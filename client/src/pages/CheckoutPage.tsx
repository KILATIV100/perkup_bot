import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, ordersApi } from '../lib/api'
import { useCartStore } from '../stores/cart'
import { useLocationStore } from '../stores/location'
import { useAuthStore } from '../stores/auth'

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

  const submit = async () => {
    if (!activeLocation) return setError('Оберіть локацію')
    if (!items.length) return setError('Кошик порожній')
    if (activeLocation.posSystem === 'POSTER' && !customerPhone.trim()) {
      return setError('Вкажи номер телефону для передзамовлення')
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
      setError(e?.response?.data?.error || 'Не вдалося створити замовлення')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-coffee-700">Оформлення замовлення</h1>

      {activeLocation?.posSystem === 'POSTER' && (
        <div>
          <label className="text-sm font-medium">Номер телефону</label>
          <input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="mt-1 w-full border rounded-xl px-3 py-2"
            placeholder="Наприклад: +380501234567"
            inputMode="tel"
          />
          <div className="mt-1 text-xs text-gray-500">Poster вимагає телефон клієнта для створення вхідного замовлення.</div>
        </div>
      )}

      <div>
        <label className="text-sm font-medium">Коментар</label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2" rows={3} placeholder="Наприклад: без цукру" />
      </div>

      <div>
        <label className="text-sm font-medium">Оплата</label>
        <div className="mt-2 rounded-2xl border border-coffee-200 bg-coffee-50 p-3 text-sm text-coffee-900">
          Оплата проходить тільки на касі у бариста через POS цієї кав'ярні. Спосіб оплати бариста вибере під час розрахунку.
        </div>
      </div>

      {activeLocation?.posSystem === 'POSTER' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Бонуси за це замовлення будуть нараховані після оплати на касі. Списання бонусів у передзамовленні для Poster-точок поки вимкнене, щоб сума в застосунку не розходилась із POS.
        </div>
      )}

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button onClick={submit} disabled={loading} className="w-full px-4 py-3 rounded-2xl bg-coffee-700 text-white disabled:opacity-60">
        {loading ? 'Створюємо...' : 'Замовити'}
      </button>
    </div>
  )
}
