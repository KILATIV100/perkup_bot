import { useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { ordersApi } from '../lib/api'
import { useT } from '../lib/i18n'

const STATUS_CONFIG: Record<string, { label: string; emoji: string; color: string; description: string }> = {
  PENDING:      { label: 'Очікує',          emoji: '⏳', color: 'text-yellow-600 bg-yellow-50 border-yellow-200',   description: 'Замовлення отримано, очікує підтвердження' },
  SENT_TO_POS:  { label: 'Надіслано в касу',emoji: '📨', color: 'text-blue-600 bg-blue-50 border-blue-200',         description: 'Замовлення надіслано баристі' },
  ACCEPTED:     { label: 'Прийнято',        emoji: '✅', color: 'text-green-600 bg-green-50 border-green-200',       description: 'Бариста прийняв замовлення' },
  PREPARING:    { label: 'Готується',       emoji: '☕', color: 'text-coffee-600 bg-coffee-50 border-coffee-200',    description: 'Бариста готує ваше замовлення' },
  READY:        { label: 'Готово!',         emoji: '🎉', color: 'text-green-700 bg-green-50 border-green-300',       description: 'Ваше замовлення готове, підійдіть до каси' },
  COMPLETED:    { label: 'Завершено',       emoji: '⭐', color: 'text-gray-600 bg-gray-50 border-gray-200',          description: 'Дякуємо! Бонуси нараховано' },
  CANCELLED:    { label: 'Скасовано',       emoji: '❌', color: 'text-red-600 bg-red-50 border-red-200',             description: 'Замовлення скасовано' },
  UNASSIGNED:   { label: 'Обробляється',   emoji: '🔄', color: 'text-purple-600 bg-purple-50 border-purple-200',    description: 'Зміну ще не відкрито, замовлення буде прийнято' },
}

export default function OrderStatusPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const t = useT()

  const query = useQuery({
    queryKey: ['order', id],
    enabled: !!id,
    refetchInterval: (data) => {
      const status = data?.state?.data?.status
      if (status === 'COMPLETED' || status === 'CANCELLED') return false
      return 5000
    },
    queryFn: async () => {
      const res = await ordersApi.getById(Number(id))
      return res.data.order
    },
  })

  if (query.isLoading) return (
    <div className="p-4 flex items-center justify-center min-h-[200px]">
      <div className="w-8 h-8 border-2 border-coffee-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (query.isError || !query.data) return (
    <div className="p-4 text-red-600">Не вдалось завантажити замовлення</div>
  )

  const order = query.data
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING

  return (
    <div className="p-4 pb-24 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/menu')} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-100 shadow-sm">
          ←
        </button>
        <h1 className="text-xl font-bold text-coffee-700">Замовлення #{order.id}</h1>
      </div>

      {/* Status card */}
      <div className={`rounded-2xl border-2 p-5 ${cfg.color}`}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{cfg.emoji}</span>
          <div>
            <div className="font-bold text-lg">{cfg.label}</div>
            <div className="text-sm opacity-80">{cfg.description}</div>
          </div>
        </div>
        {(order.status === 'PENDING' || order.status === 'SENT_TO_POS' || order.status === 'ACCEPTED' || order.status === 'PREPARING') && (
          <div className="mt-3 text-xs opacity-60">Оновлюється автоматично кожні 5 сек...</div>
        )}
      </div>

      {/* Order items */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-50 font-semibold text-gray-700">Склад замовлення</div>
        {order.items?.map((item: any, i: number) => (
          <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-gray-50 last:border-0">
            <div>
              <div className="text-sm font-medium text-gray-900">{item.name}</div>
              <div className="text-xs text-gray-400">× {item.quantity}</div>
            </div>
            <div className="text-sm font-semibold text-coffee-700">
              {(Number(item.price) * item.quantity).toFixed(0)} грн
            </div>
          </div>
        ))}
        <div className="flex justify-between items-center px-4 py-3 bg-coffee-50 rounded-b-2xl">
          <span className="font-bold text-gray-800">Разом</span>
          <span className="font-bold text-coffee-700">{Number(order.total).toFixed(0)} грн</span>
        </div>
      </div>

      {/* Location */}
      {order.location && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
          <span className="text-xl">📍</span>
          <div>
            <div className="text-xs text-gray-500">Локація</div>
            <div className="font-medium text-gray-900">{order.location.name}</div>
          </div>
        </div>
      )}

      {order.status === 'READY' && (
        <div className="bg-green-600 text-white rounded-2xl p-4 text-center font-bold text-lg animate-pulse">
          🎉 Підійдіть до каси!
        </div>
      )}

      {order.status === 'COMPLETED' && (
        <button onClick={() => navigate('/menu')} className="w-full py-3 rounded-2xl bg-coffee-600 text-white font-semibold">
          Зробити нове замовлення ☕
        </button>
      )}
    </div>
  )
}
