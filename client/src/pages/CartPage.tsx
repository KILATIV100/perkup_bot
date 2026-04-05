import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../stores/cart'

export default function CartPage() {
  const navigate = useNavigate()
  const { items, updateItem, removeItem, getTotalPrice } = useCartStore()

  if (!items.length) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold text-coffee-700 mb-2">🛒 Кошик</h1>
        <p className="text-gray-600">Кошик порожній</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3 pb-28">
      <h1 className="text-2xl font-bold text-coffee-700">🛒 Кошик</h1>
      {items.map((item) => (
        <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-3">
          <div className="flex justify-between items-center">
            <div>
              <div className="font-semibold">{item.name}</div>
              <div className="text-sm text-gray-500">{Math.round(item.price)} грн</div>
            </div>
            <button onClick={() => removeItem(item.id)} className="text-red-500 text-sm">Видалити</button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button className="px-2 py-1 border rounded" onClick={() => updateItem(item.id, { quantity: Math.max(1, item.quantity - 1) })}>-</button>
            <span>{item.quantity}</span>
            <button className="px-2 py-1 border rounded" onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })}>+</button>
          </div>
        </div>
      ))}

      <button onClick={() => navigate('/checkout')} className="fixed left-3 right-3 bottom-20 z-40 px-4 py-3 rounded-2xl bg-coffee-700 text-white shadow-xl">
        Оформити ({Math.round(getTotalPrice())} грн)
      </button>
    </div>
  )
}
