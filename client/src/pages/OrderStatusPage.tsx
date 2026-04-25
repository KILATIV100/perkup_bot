import { useMutation, useQuery } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { ordersApi } from '../lib/api'
import { useT } from '../lib/i18n'
import { useCartStore } from '../stores/cart'
import { useLocationStore } from '../stores/location'
import { FEATURES } from '../lib/features'

const STATUS_STEPS = ['PENDING', 'SENT_TO_POS', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED']

const STATUS_CONFIG: Record<string, { label: string; emoji: string; desc: string; color: string; step: number }> = {
  PENDING:     { label: 'Отримано',       emoji: '📥', desc: 'Замовлення прийнято, відправляємо баристі',  color: 'bg-stone-50 border-stone-200',        step: 0 },
  SENT_TO_POS: { label: 'У баристи',      emoji: '📨', desc: 'Бариста бачить ваше замовлення',              color: 'bg-blue-50 border-blue-200',           step: 1 },
  ACCEPTED:    { label: 'Прийнято',       emoji: '✅', desc: 'Бариста підтвердив замовлення',               color: 'bg-green-50 border-green-200',         step: 2 },
  PREPARING:   { label: 'Готується',      emoji: '☕', desc: 'Ваша кава вже готується!',                   color: 'bg-amber-50 border-amber-200',         step: 3 },
  READY:       { label: 'Готово!',        emoji: '🎉', desc: 'Підійдіть до каси і забирайте',               color: 'bg-green-50 border-green-300',         step: 4 },
  COMPLETED:   { label: 'Завершено',      emoji: '⭐', desc: 'Дякуємо! Приходьте знову ☕',                 color: 'bg-stone-50 border-stone-200',         step: 5 },
  CANCELLED:   { label: 'Скасовано',      emoji: '❌', desc: 'Замовлення скасовано баристою',               color: 'bg-red-50 border-red-200',             step: -1 },
  UNASSIGNED:  { label: 'Зміну не відкрито', emoji: '🔄', desc: 'Замовлення прийнято, але зміна ще не відкрита', color: 'bg-violet-50 border-violet-200', step: 0 },
}

const ACTIVE_STATUSES = ['PENDING', 'SENT_TO_POS', 'ACCEPTED', 'PREPARING', 'READY', 'UNASSIGNED']

export default function OrderStatusPage() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const t          = useT()
  const { clearCart, addItem } = useCartStore()
  const setActiveLocation      = useLocationStore(s => s.setActiveLocation)

  const query = useQuery({
    queryKey: ['order', id],
    enabled: !!id,
    refetchInterval: data => {
      const st = data?.state?.data?.status
      if (st === 'COMPLETED' || st === 'CANCELLED') return false
      return 5000
    },
    queryFn: async () => {
      const res = await ordersApi.getById(Number(id))
      return res.data.order
    },
  })

  const addTipMutation = useMutation({
    mutationFn: async (amount: number) => { await ordersApi.addTip(query.data!.id, amount) },
    onSuccess: () => query.refetch(),
  })

  const handleRepeat = () => {
    if (!query.data?.items?.length) return
    clearCart()
    if (query.data.location) setActiveLocation(query.data.location)
    query.data.items.forEach((item: any) => addItem({
      productId: item.productId, bundleId: item.bundleId,
      name: item.name, price: Number(item.price),
      quantity: Number(item.quantity) || 1, modifiers: item.modifiers || undefined,
      locationId: query.data.location?.id,
    }))
    navigate('/cart')
  }

  if (query.isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (query.isError || !query.data) return (
    <div className="p-4 text-red-600 text-sm">Не вдалось завантажити замовлення</div>
  )

  const order      = query.data
  const cfg        = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING
  const isActive   = ACTIVE_STATUSES.includes(order.status)
  const isDone     = order.status === 'COMPLETED' || order.status === 'CANCELLED'
  const isReady    = order.status === 'READY'
  const isCompleted = order.status === 'COMPLETED'
  const totalFormatted = Number(order.total).toFixed(0)

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-28">

      {/* Header */}
      <div className="bg-amber-900 px-5 pt-5 pb-6">
        <button onClick={() => navigate('/menu')} className="text-amber-200 text-sm mb-3 flex items-center gap-1">
          ← Меню
        </button>
        <h1 className="text-white text-xl font-bold">Замовлення #{order.id}</h1>
        {order.location && <p className="text-amber-200 text-sm mt-1">📍 {order.location.name}</p>}
      </div>

      <div className="px-4 py-5 space-y-4">

        {/* Статус — головна картка */}
        <div className={`rounded-2xl border-2 p-5 ${cfg.color}`}>
          <div className="flex items-center gap-4">
            <div className="text-4xl">{cfg.emoji}</div>
            <div>
              <p className="font-bold text-lg text-stone-800">{cfg.label}</p>
              <p className="text-sm text-stone-600 mt-0.5">{cfg.desc}</p>
            </div>
          </div>
          {isActive && (
            <p className="text-xs text-stone-400 mt-3">Оновлюється кожні 5 сек...</p>
          )}
        </div>

        {/* Прогрес-бар — тільки для активних не-UNASSIGNED */}
        {order.status !== 'CANCELLED' && order.status !== 'UNASSIGNED' && (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
            <div className="flex items-center gap-1">
              {STATUS_STEPS.map((step, i) => {
                const stepCfg = STATUS_CONFIG[step]
                const isDoneStep = stepCfg.step <= cfg.step
                const isCurrent  = step === order.status
                return (
                  <div key={step} className="flex items-center flex-1">
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isCurrent  ? 'bg-amber-700 text-white ring-2 ring-amber-300 ring-offset-1' :
                      isDoneStep ? 'bg-amber-700 text-white' : 'bg-stone-100 text-stone-400'
                    }`}>
                      {isDoneStep && !isCurrent ? '✓' : stepCfg.emoji}
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-0.5 transition-all ${
                        stepCfg.step < cfg.step ? 'bg-amber-700' : 'bg-stone-100'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-stone-400 text-center mt-3">
              {['Отримано', 'У баристи', 'Прийнято', 'Готується', 'Готово', 'Завершено'][Math.max(0, cfg.step)]}
            </p>
          </div>
        )}

        {/* READY банер */}
        {isReady && (
          <div className="bg-green-600 text-white rounded-2xl p-4 text-center animate-pulse shadow-lg">
            <p className="text-2xl mb-1">☕</p>
            <p className="font-bold text-lg">Підійдіть до каси!</p>
            <p className="text-sm opacity-90 mt-1">Ваше замовлення чекає на вас</p>
          </div>
        )}

        {/* Склад замовлення */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-50 font-semibold text-stone-800 text-sm">
            🛒 Склад замовлення
          </div>
          {order.items?.map((item: any, i: number) => (
            <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-stone-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-stone-900">{item.name}</p>
                <p className="text-xs text-stone-400">× {item.quantity}</p>
              </div>
              <p className="text-sm font-bold text-amber-800">
                {(Number(item.price) * (item.quantity || 1)).toFixed(0)} грн
              </p>
            </div>
          ))}
          <div className="flex justify-between items-center px-4 py-3 bg-stone-50 font-bold text-stone-800">
            <span>Разом</span>
            <span className="text-amber-800">{totalFormatted} грн</span>
          </div>
        </div>

        {/* Коментар */}
        {order.comment && (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm px-4 py-3">
            <p className="text-xs text-stone-400 mb-1">💬 Коментар</p>
            <p className="text-sm text-stone-700">{order.comment}</p>
          </div>
        )}

        {/* Чайові */}
        {FEATURES.TIPS && isCompleted && (
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4 space-y-3">
            <div>
              <p className="font-semibold text-stone-800">{t('order.tip.title')}</p>
              <p className="text-xs text-stone-400 mt-0.5">{t('order.tip.subtitle')}</p>
            </div>
            {order.tip ? (
              <p className="text-sm font-medium text-green-600">{t('order.tip.added')} ({Number(order.tip.amount).toFixed(0)} грн)</p>
            ) : (
              <div className="flex gap-2">
                {[10, 20, 50].map(tip => (
                  <button
                    key={tip}
                    disabled={addTipMutation.isPending}
                    onClick={() => addTipMutation.mutate(tip)}
                    className="flex-1 py-2.5 rounded-xl border border-amber-200 text-amber-700 font-semibold text-sm disabled:opacity-50 active:scale-95 transition-transform"
                  >
                    +{tip} грн
                  </button>
                ))}
              </div>
            )}
            {addTipMutation.isError && <p className="text-xs text-red-600">{t('common.error')}</p>}
          </div>
        )}

        {/* Повторити замовлення */}
        {isDone && (
          <button
            onClick={handleRepeat}
            className="w-full py-3.5 rounded-2xl bg-amber-800 text-white font-bold active:scale-95 transition-transform"
          >
            {t('order.repeat')}
          </button>
        )}
      </div>
    </div>
  )
}
