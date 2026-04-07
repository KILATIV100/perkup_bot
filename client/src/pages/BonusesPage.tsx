import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'

interface LoyaltyStatus {
  points: number
  level: string
  multiplier: number
  nextLevel: { name: string; required: number } | null
  spinsAvailable: number
  completedOrders: number
  transactions: Array<{ id: number; amount: number; type: string; description: string; createdAt: string }>
  vouchers: Array<{ id: number; code: string; prizeLabel: string; prizeType: string; expiresAt: string }>
}

interface Prize {
  id: string
  label: string
  emoji: string
  type: string
  value: number
  weight: number
}

const WHEEL_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#f97316', '#0891b2', '#6b7280']

function buildWheelGradient(prizes: Prize[]): string {
  const total = prizes.reduce((s, p) => s + p.weight, 0)
  let cum = 0
  return prizes.map((p, i) => {
    const start = (cum / total) * 360
    cum += p.weight
    const end = (cum / total) * 360
    return `${WHEEL_COLORS[i % WHEEL_COLORS.length]} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`
  }).join(', ')
}

function getSegmentCenter(prizes: Prize[], idx: number): number {
  const total = prizes.reduce((s, p) => s + p.weight, 0)
  let cum = 0
  for (let i = 0; i < idx; i++) cum += prizes[i].weight
  const start = (cum / total) * 360
  const end = ((cum + prizes[idx].weight) / total) * 360
  return (start + end) / 2
}

const LEVELS = [
  { name: 'Bronze', min: 0,    max: 299,  color: 'from-amber-600 to-amber-700',   text: 'text-amber-700', multiplier: '×1.0' },
  { name: 'Silver', min: 300,  max: 999,  color: 'from-gray-400 to-gray-500',     text: 'text-gray-500',  multiplier: '×1.1' },
  { name: 'Gold',   min: 1000, max: 2999, color: 'from-yellow-400 to-yellow-500', text: 'text-yellow-600',multiplier: '×1.2' },
  { name: 'Platinum', min: 3000, max: Infinity, color: 'from-sky-400 to-indigo-500', text: 'text-indigo-600', multiplier: '×1.3' },
]

export default function BonusesPage() {
  const [status, setStatus] = useState<LoyaltyStatus | null>(null)
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [spinResult, setSpinResult] = useState<{ prize: Prize; voucherCode: string | null } | null>(null)
  const [activeTab, setActiveTab] = useState<'wheel' | 'rules' | 'history'>('wheel')
  const [loading, setLoading] = useState(true)
  const spinRef = useRef(rotation)
  spinRef.current = rotation

  const loadStatus = async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        api.get('/api/loyalty/status'),
        api.get('/api/loyalty/prizes'),
      ])
      setStatus(sRes.data)
      setPrizes(pRes.data.prizes || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { loadStatus() }, [])

  const handleSpin = async () => {
    if (spinning || !status || status.spinsAvailable <= 0) return
    setSpinning(true)
    setSpinResult(null)
    try {
      const res = await api.post('/api/loyalty/spin')
      const { prizeIndex, prize, voucherCode, prizes: serverPrizes } = res.data
      const allPrizes: Prize[] = serverPrizes || prizes
      if (allPrizes.length === 0) return

      const center = getSegmentCenter(allPrizes, prizeIndex)
      const targetRotation = spinRef.current + 5 * 360 + (360 - center)
      setRotation(targetRotation)

      setTimeout(async () => {
        setSpinning(false)
        setSpinResult({ prize, voucherCode })
        await loadStatus()
      }, 4200)
    } catch (err: any) {
      setSpinning(false)
      alert(err?.response?.data?.error || 'Помилка спіну')
    }
  }

  const currentLevel = LEVELS.find(l => (status?.points ?? 0) >= l.min && (status?.points ?? 0) <= l.max) || LEVELS[0]
  const nextLevelInfo = status?.nextLevel
  const progressPct = nextLevelInfo
    ? Math.min(100, Math.round(((status?.points ?? 0) - currentLevel.min) / (nextLevelInfo.required - currentLevel.min) * 100))
    : 100

  return (
    <div className="pb-24">
      {/* Level Card */}
      <div className={`bg-gradient-to-br ${currentLevel.color} p-5 text-white`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs opacity-80 font-medium">Рівень</div>
            <div className="text-2xl font-bold">{currentLevel.name}</div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-80">Бали</div>
            <div className="text-3xl font-bold">{loading ? '...' : status?.points ?? 0}</div>
          </div>
        </div>
        {nextLevelInfo && (
          <div className="mt-3">
            <div className="flex justify-between text-xs opacity-80 mb-1">
              <span>{status?.points ?? 0} балів</span>
              <span>{nextLevelInfo.required} → {nextLevelInfo.name}</span>
            </div>
            <div className="bg-white/30 rounded-full h-2">
              <div
                className="bg-white rounded-full h-2 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex gap-4 mt-3 text-xs opacity-90">
          <span>Множник {currentLevel.multiplier}</span>
          <span>• {status?.spinsAvailable ?? 0} спінів доступно</span>
          <span>• {status?.completedOrders ?? 0} замовлень</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-white sticky top-0 z-10">
        {(['wheel', 'rules', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab ? 'text-coffee-700 border-b-2 border-coffee-600' : 'text-gray-400'
            }`}
          >
            {tab === 'wheel' ? '🎡 Колесо' : tab === 'rules' ? '📋 Умови' : '📜 Історія'}
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* WHEEL TAB */}
        {activeTab === 'wheel' && (
          <div className="space-y-4">
            {/* Wheel */}
            <div className="flex flex-col items-center">
              <div className="relative mb-4">
                {/* Pointer */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10 w-0 h-0"
                  style={{ borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '20px solid #7c3aed' }} />

                {/* Wheel */}
                <div
                  className="w-64 h-64 rounded-full border-4 border-white shadow-2xl"
                  style={{
                    background: prizes.length > 0
                      ? `conic-gradient(${buildWheelGradient(prizes)})`
                      : '#e5e7eb',
                    transform: `rotate(${rotation}deg)`,
                    transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
                  }}
                >
                  {/* Segment labels */}
                  {prizes.length > 0 && (() => {
                    const total = prizes.reduce((s, p) => s + p.weight, 0)
                    let cum = 0
                    return prizes.map((p, i) => {
                      const start = (cum / total) * 360
                      cum += p.weight
                      const end = (cum / total) * 360
                      const mid = (start + end) / 2
                      const r = 88
                      const rad = ((mid - 90) * Math.PI) / 180
                      const x = 128 + r * Math.cos(rad)
                      const y = 128 + r * Math.sin(rad)
                      return (
                        <div
                          key={p.id}
                          className="absolute text-xs font-bold text-white pointer-events-none select-none"
                          style={{
                            left: x,
                            top: y,
                            transform: `translate(-50%, -50%) rotate(${mid}deg)`,
                            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                            fontSize: '9px',
                            width: '50px',
                            textAlign: 'center',
                            lineHeight: '1.2',
                          }}
                        >
                          {p.emoji} {p.label}
                        </div>
                      )
                    })
                  })()}
                </div>

                {/* Center circle */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-white shadow-inner border-2 border-gray-200 flex items-center justify-center text-lg">
                    ☕
                  </div>
                </div>
              </div>

              {/* Spin button */}
              <button
                onClick={handleSpin}
                disabled={spinning || (status?.spinsAvailable ?? 0) <= 0 || loading}
                className="px-8 py-3 rounded-2xl bg-coffee-600 text-white font-semibold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-transform"
              >
                {spinning ? 'Крутимо...' : (status?.spinsAvailable ?? 0) > 0 ? `Крутити (${status?.spinsAvailable})` : 'Немає спінів'}
              </button>
              <div className="text-xs text-gray-400 mt-2">Кожне 5-те замовлення = 1 спін</div>
            </div>

            {/* Spin Result */}
            {spinResult && (
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-4 text-center animate-pulse">
                <div className="text-3xl mb-2">{spinResult.prize.emoji}</div>
                <div className="font-bold text-purple-800 text-lg">{spinResult.prize.label}</div>
                {spinResult.voucherCode && (
                  <div className="mt-2 bg-white rounded-xl px-4 py-2 font-mono font-bold text-coffee-700 text-sm border border-purple-200">
                    {spinResult.voucherCode}
                  </div>
                )}
              </div>
            )}

            {/* Active vouchers */}
            {(status?.vouchers?.length ?? 0) > 0 && (
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">Активні ваучери</div>
                <div className="space-y-2">
                  {status!.vouchers.map(v => (
                    <div key={v.id} className="bg-white border border-gray-100 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium">{v.prizeLabel}</div>
                        <div className="text-xs text-gray-400">до {new Date(v.expiresAt).toLocaleDateString('uk-UA')}</div>
                      </div>
                      <div className="font-mono font-bold text-coffee-700 text-sm bg-coffee-50 px-2 py-1 rounded-lg">{v.code}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* RULES TAB */}
        {activeTab === 'rules' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="font-semibold text-coffee-800">Нарахування балів</div>
              <div className="text-sm text-gray-600 space-y-1">
                <div>• 1 бал за кожні 5 грн замовлення</div>
                <div>• Множник залежить від рівня</div>
                <div>• Бали нараховуються після виконання замовлення</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="font-semibold text-coffee-800">Списання балів</div>
              <div className="text-sm text-gray-600 space-y-1">
                <div>• 1 бал = 1 грн знижки</div>
                <div>• Максимум 20% від суми замовлення</div>
                <div>• Обирайте при оформленні замовлення</div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="font-semibold text-coffee-800 mb-3">Рівні та множники</div>
              <div className="space-y-2">
                {LEVELS.map(l => (
                  <div key={l.name} className={`flex items-center justify-between p-2 rounded-xl ${
                    currentLevel.name === l.name ? 'bg-coffee-50 border border-coffee-200' : ''
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${l.color}`} />
                      <span className="text-sm font-medium">{l.name}</span>
                      {currentLevel.name === l.name && (
                        <span className="text-[10px] bg-coffee-600 text-white px-1.5 py-0.5 rounded-full">Ваш</span>
                      )}
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <div>{l.max === Infinity ? `${l.min}+` : `${l.min}–${l.max}`} балів</div>
                      <div className="font-semibold text-coffee-600">{l.multiplier}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="font-semibold text-coffee-800">Колесо фортуни</div>
              <div className="text-sm text-gray-600 space-y-1">
                <div>• Кожне 5-те завершене замовлення = 1 спін</div>
                <div>• Призи: бали, ваучери, знижки</div>
                <div>• Ваучери дійсні 7 днів після отримання</div>
              </div>
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-2">
            {loading && <div className="text-center text-gray-400 py-8">Завантаження...</div>}
            {!loading && (status?.transactions?.length ?? 0) === 0 && (
              <div className="text-center text-gray-400 py-8">Немає транзакцій</div>
            )}
            {status?.transactions?.map(tx => (
              <div key={tx.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-700">{tx.description}</div>
                  <div className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleDateString('uk-UA')}</div>
                </div>
                <div className={`font-semibold text-sm ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
