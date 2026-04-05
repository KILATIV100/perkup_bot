import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { ordersApi } from '../lib/api'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '⏳ Очікує',
  ACCEPTED: '✅ Прийнято',
  PREPARING: '👨‍🍳 Готується',
  READY: '☕ Готово',
  COMPLETED: '🎉 Видано',
  CANCELLED: '❌ Скасовано',
  UNASSIGNED: '⚠️ Немає зміни',
}

export default function OrderStatusPage() {
  const { id } = useParams()

  const query = useQuery({
    queryKey: ['order', id],
    enabled: !!id,
    refetchInterval: 5000,
    queryFn: async () => {
      const res = await ordersApi.getById(Number(id))
      return res.data.order
    },
  })

  if (query.isLoading) return <div className="p-4">Завантаження замовлення...</div>
  if (query.isError || !query.data) return <div className="p-4 text-red-600">Не вдалося завантажити статус</div>

  const order = query.data

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-coffee-700">Замовлення #{order.id}</h1>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="text-sm text-gray-500 mb-1">Статус</div>
        <div className="text-xl font-semibold">{STATUS_LABEL[order.status] || order.status}</div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="text-sm text-gray-500 mb-2">QR-код для видачі</div>
        <div className="font-mono text-sm break-all">{order.qrCode || 'Ще формується...'}</div>
      </div>
    </div>
  )
}
