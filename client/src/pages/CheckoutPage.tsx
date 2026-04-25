import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, ordersApi, promosApi } from '../lib/api'
import { useCartStore } from '../stores/cart'
import { useLocationStore } from '../stores/location'
import { useAuthStore } from '../stores/auth'
import { useT } from '../lib/i18n'
import { FEATURES } from '../lib/features'

const PHONE_KEY = 'perkup_customer_phone'

export default function CheckoutPage() {
  const navigate   = useNavigate()
  const { activeLocation }    = useLocationStore()
  const { user, updateUser }  = useAuthStore()
  const { items, clearCart }  = useCartStore()
  const t = useT()

  const isPoster = activeLocation?.posSystem === 'POSTER'

  const [phone,     setPhone]     = useState(() => user?.phone || localStorage.getItem(PHONE_KEY) || '')
  const [comment,   setComment]   = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [promoDiscount, setPromoDiscount] = useState<number | null>(null)
  const [promoError,    setPromoError]    = useState('')
  const [promoLoading,  setPromoLoading]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const subtotal = Math.round(items.reduce((s, i) => s + i.price * i.quantity, 0))
  const discount = promoDiscount ?? 0
  const total    = Math.max(0, subtotal - discount)

  const applyPromo = async () => {
    if (!FEATURES.PROMOS || isPoster) return
    if (!activeLocation) return setPromoError(t('checkout.selectLocation'))
    if (!promoCode.trim()) return setPromoError(t('checkout.promoRequired'))
    setPromoLoading(true); setPromoError('')
    try {
      const res = await promosApi.validate({ code: promoCode.trim(), locationId: activeLocation.id, subtotal })
      setPromoDiscount(Number(res.data?.promo?.discount || 0))
    } catch (e: any) {
      setPromoDiscount(null)
      setPromoError(e?.response?.data?.error || t('common.error'))
    } finally { setPromoLoading(false) }
  }

  const submit = async () => {
    if (!activeLocation) return setError(t('checkout.selectLocation'))
    if (!items.length) return setError(t('checkout.emptyCart'))
    if (isPoster && !phone.trim()) return setError(t('checkout.phoneRequired'))
    setLoading(true); setError('')
    try {
      if (phone.trim()) localStorage.setItem(PHONE_KEY, phone.trim())
      const res = await ordersApi.create({
        locationId: activeLocation.id,
        customerPhone: phone.trim() || undefined,
        comment: comment || undefined,
        promoCode: FEATURES.PROMOS && !isPoster && promoCode.trim() ? promoCode.trim() : undefined,
        items: items.map(i => ({ productId: i.productId, bundleId: i.bundleId, quantity: i.quantity, modifiers: i.modifiers })),
      })
      if (isPoster && phone.trim() && phone.trim() !== (user?.phone || '')) {
        try { await authApi.updateSettings({ phone: phone.trim() }); updateUser({ phone: phone.trim() }) } catch {}
      }
      clearCart()
      navigate(`/orders/${res.data.orderId}`)
    } catch (e: any) {
      const err = e?.response?.data?.error
      if (err === 'CASH_PAYMENT_BLOCKED') {
        setError(e?.response?.data?.message || 'Передзамовлення тимчасово обмежено. Зверніться до бариста.')
      } else {
        setError(err || t('common.error'))
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-28">

      {/* Header */}
      <div className="bg-amber-900 px-5 pt-5 pb-6">
        <button onClick={() => navigate('/cart')} className="text-amber-200 text-sm mb-3 flex items-center gap-1">
          ← Кошик
        </button>
        <h1 className="text-white text-xl font-bold">Оформлення замовлення</h1>
        <p className="text-amber-200 text-sm mt-1">{activeLocation?.name}</p>
      </div>

      <div className="px-4 py-5 space-y-4">

        {/* Склад замовлення */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-50">
            <p className="font-semibold text-stone-800 text-sm">🛒 Ваше замовлення</p>
          </div>
          {items.map(item => (
            <div key={item.id} className="flex justify-between items-center px-4 py-3 border-b border-stone-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-stone-800">{item.name}</p>
                <p className="text-xs text-stone-400">× {item.quantity} · {Math.round(item.price)} грн/шт</p>
              </div>
              <p className="text-sm font-bold text-amber-800">{Math.round(item.price * item.quantity)} грн</p>
            </div>
          ))}
          {/* Підсумок */}
          <div className="px-4 py-3 bg-stone-50 space-y-1">
            <div className="flex justify-between text-sm text-stone-500">
              <span>Підсумок</span><span>{subtotal} грн</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Знижка</span><span>−{discount} грн</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-stone-800 text-base pt-1 border-t border-stone-200">
              <span>До сплати</span><span>{total} грн</span>
            </div>
          </div>
        </div>

        {/* Телефон — тільки для Poster */}
        {isPoster && (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4 space-y-2">
            <label className="text-sm font-semibold text-stone-800">📱 {t('checkout.phone')}</label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              type="tel"
              inputMode="tel"
              placeholder="+380 50 123 45 67"
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm bg-white text-stone-900 focus:border-amber-400 focus:outline-none"
            />
            <p className="text-xs text-stone-400">{t('checkout.phoneHint')}</p>
          </div>
        )}

        {/* Коментар */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4 space-y-2">
          <label className="text-sm font-semibold text-stone-800">💬 {t('checkout.comment')}</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            rows={2}
            placeholder={t('checkout.commentPlaceholder')}
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-stone-900 focus:border-amber-400 focus:outline-none resize-none"
          />
        </div>

        {/* Промокод — тільки для не-Poster */}
        {FEATURES.PROMOS && !isPoster && (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4 space-y-2">
            <label className="text-sm font-semibold text-stone-800">🎟️ {t('checkout.promoLabel')}</label>
            <div className="flex gap-2">
              <input
                value={promoCode}
                onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoDiscount(null); setPromoError('') }}
                className="flex-1 border border-stone-200 rounded-xl px-3 py-2 text-sm bg-white text-stone-900 focus:border-amber-400 focus:outline-none"
                placeholder={t('checkout.promoPlaceholder')}
              />
              <button
                onClick={applyPromo}
                disabled={promoLoading || !promoCode.trim()}
                className="px-4 py-2 rounded-xl bg-amber-100 text-amber-800 text-sm font-medium disabled:opacity-50"
              >
                {promoLoading ? '...' : t('checkout.promoApply')}
              </button>
            </div>
            {promoDiscount !== null && <p className="text-xs text-green-600">✅ {t('checkout.promoApplied')}: −{promoDiscount} грн</p>}
            {promoError && <p className="text-xs text-red-600">{promoError}</p>}
          </div>
        )}

        {/* Оплата — інформація */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-900">💳 Оплата</p>
          <p className="text-sm text-amber-800">{t('checkout.cashierOnly')}</p>
          {isPoster && (
            <p className="text-xs text-amber-700 border-t border-amber-200 pt-2 mt-2">
              {t('checkout.posterBonus')}
            </p>
          )}
        </div>

        {/* Помилка */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
            ❌ {error}
          </div>
        )}
      </div>

      {/* Кнопка — фіксована внизу */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-5 pt-3 bg-white/95 backdrop-blur border-t border-stone-100">
        <button
          onClick={submit}
          disabled={loading}
          className="w-full py-4 rounded-2xl bg-amber-800 text-white font-bold text-base shadow-lg active:scale-95 transition-transform disabled:opacity-60"
        >
          {loading ? 'Оформляємо...' : `Замовити · ${total} грн`}
        </button>
      </div>
    </div>
  )
}
