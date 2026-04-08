import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { ordersApi } from '../lib/api'
import { useT } from '../lib/i18n'

export default function OrderStatusPage() {
  const { id } = useParams()
  const t = useT()

  const STATUS_LABEL: Record<string, string> = {
    PENDING: t('order.status.PENDING'),
    SENT_TO_POS: t('order.status.SENT_TO_POS'),
    ACCEPTED: t('order.status.ACCEPTED'),
    PREPARING: t('order.status.PREPARING'),
    READY: t('order.status.READY'),
    COMPLETED: t('order.status.COMPLETED'),
    CANCELLED: t('order.status.CANCELLED'),
    UNASSIGNED: t('order.status.UNASSIGNED'),
  }

  const query = useQuery({
    queryKey: ['order', id],
    enabled: !!id,
    refetchInterval: 5000,
    queryFn: async () => {
      const res = await ordersApi.getById(Number(id))
      return res.data.order
    },
  })

  if (query.isLoading) return <div className="p-4">{t('common.loading')}</div>
  if (query.isError || !query.data) return <div className="p-4 text-red-600">{t('common.loadFailed')}</div>

  const order = query.data

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-coffee-700">{t('order.title')} #{order.id}</h1>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="text-sm text-gray-500 mb-1">{t('order.status')}</div>
        <div className="text-xl font-semibold">{STATUS_LABEL[order.status] || order.status}</div>
        {order.posterOrderId && <div className="text-xs text-gray-400 mt-2">Poster ID: {order.posterOrderId}</div>}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="text-sm text-gray-500 mb-2">{t('order.qrCode')}</div>
        <div className="font-mono text-sm break-all">{order.qrCode || t('order.loading')}</div>
      </div>
    </div>
  )
}
