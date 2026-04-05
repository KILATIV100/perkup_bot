import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ordersApi } from '../lib/api'
import { useCartStore } from '../stores/cart'
import { useLocationStore } from '../stores/location'

export default function CheckoutPage() {
  const navigate = useNavigate()
  const { activeLocation } = useLocationStore()
  const { items, clearCart } = useCartStore()
  const [comment, setComment] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('cash')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!activeLocation) return setError('Оберіть локацію')
    if (!items.length) return setError('Кошик порожній')

    setLoading(true)
    setError('')
    try {
      const res = await ordersApi.create({
        locationId: activeLocation.id,
        paymentMethod,
        comment: comment || undefined,
        items: items.map((i) => ({ productId: i.productId, bundleId: i.bundleId, quantity: i.quantity, modifiers: i.modifiers })),
      })

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

      <div>
        <label className="text-sm font-medium">Коментар</label>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2" rows={3} placeholder="Наприклад: без цукру" />
      </div>

      <div>
        <label className="text-sm font-medium">Оплата</label>
        <div className="mt-2 flex gap-2">
          <button onClick={() => setPaymentMethod('cash')} className={`px-3 py-2 rounded-xl border ${paymentMethod === 'cash' ? 'bg-coffee-600 text-white' : 'bg-white'}`}>Готівка</button>
          <button onClick={() => setPaymentMethod('card')} className={`px-3 py-2 rounded-xl border ${paymentMethod === 'card' ? 'bg-coffee-600 text-white' : 'bg-white'}`}>Картка</button>
        </div>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button onClick={submit} disabled={loading} className="w-full px-4 py-3 rounded-2xl bg-coffee-700 text-white disabled:opacity-60">
        {loading ? 'Створюємо...' : 'Замовити'}
      </button>
    </div>
  )
}
