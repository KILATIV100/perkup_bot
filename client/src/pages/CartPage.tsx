import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../stores/cart'
import { useT } from '../lib/i18n'

export default function CartPage() {
  const navigate = useNavigate()
  const { items, updateItem, removeItem, getTotalPrice } = useCartStore()
  const t = useT()
  const total = Math.round(getTotalPrice())

  if (!items.length) return (
    <div className="min-h-screen bg-[#FAF7F4] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-5xl">🛒</div>
      <h1 className="text-xl font-bold text-stone-800">{t('cart.title')}</h1>
      <p className="text-stone-500 text-sm">{t('cart.empty')}</p>
      <button onClick={() => navigate('/menu')}
        className="mt-2 px-6 py-3 rounded-2xl bg-amber-800 text-white font-semibold active:scale-95 transition-transform">
        До меню
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-28">

      {/* Header */}
      <div className="bg-amber-900 px-5 pt-5 pb-6">
        <h1 className="text-white text-xl font-bold">🛒 {t('cart.title')}</h1>
        <p className="text-amber-200 text-sm mt-1">{items.length} позиц{items.length === 1 ? 'ія' : 'ії'}</p>
      </div>

      {/* Інфо про оплату */}
      <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-800">
        💳 {t('cart.paymentNotice')}
      </div>

      {/* Список товарів */}
      <div className="px-4 mt-3 space-y-2">
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="font-semibold text-stone-800">{item.name}</p>
                <p className="text-sm text-stone-400 mt-0.5">{Math.round(item.price)} грн/шт</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-amber-800">{Math.round(item.price * item.quantity)} грн</p>
                <button onClick={() => removeItem(item.id)}
                  className="text-xs text-red-400 mt-1 hover:text-red-600">
                  Видалити
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={() => updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                className="w-8 h-8 rounded-xl border border-stone-200 flex items-center justify-center text-stone-600 font-bold hover:bg-stone-50 active:scale-90 transition-transform">
                −
              </button>
              <span className="font-semibold text-stone-800 min-w-[20px] text-center">{item.quantity}</span>
              <button
                onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })}
                className="w-8 h-8 rounded-xl border border-stone-200 flex items-center justify-center text-stone-600 font-bold hover:bg-stone-50 active:scale-90 transition-transform">
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Кнопка оформлення — фіксована внизу */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-5 pt-3 bg-white/95 backdrop-blur border-t border-stone-100">
        <button
          onClick={() => navigate('/checkout')}
          className="w-full py-4 rounded-2xl bg-amber-800 text-white font-bold text-base shadow-lg active:scale-95 transition-transform">
          {t('cart.checkout')} · {total} {t('common.currency')}
        </button>
      </div>
    </div>
  )
}
