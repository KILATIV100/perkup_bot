import { useAuthStore } from '../stores/auth'

export default function BonusesPage() {
  const { user } = useAuthStore()

  return (
    <div className="p-4 pb-24">
      <h1 className="text-2xl font-bold mb-4 text-coffee-800">Лояльність</h1>
      
      <div className="bg-white p-5 rounded-2xl shadow-sm mb-4 border border-coffee-100 flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">Ваш рівень</p>
          <p className="text-2xl font-bold text-coffee-600">{user?.level || 'Bronze'}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-sm">Баланс</p>
          <p className="text-2xl font-bold text-coffee-600">{user?.points || 0}</p>
        </div>
      </div>

      <div className="bg-coffee-50 p-6 rounded-2xl shadow-inner mb-4 text-center border border-coffee-200">
        <h2 className="text-xl font-bold mb-2">Колесо Фортуни 🎡</h2>
        <p className="text-sm text-gray-600 mb-5">Крути колесо та отримуй подарунки! 1 спін = кожні 5 замовлень.</p>
        <button className="bg-coffee-600 text-white px-8 py-3 rounded-full font-bold shadow-md active:scale-95 transition-transform">
          Крутити (Доступно: 0)
        </button>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-bold mb-3 text-gray-800">Як працюють бонуси?</h3>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-coffee-500 mt-0.5">•</span>
            <span>Отримуй <b>1 бал</b> за кожні 5 грн у чеку.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-coffee-500 mt-0.5">•</span>
            <span>Оплачуй балами до <b>20%</b> вартості (1 бал = 1 грн).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-coffee-500 mt-0.5">•</span>
            <span><b>Рівні:</b> Bronze (0-299), Silver (300-999), Gold (1000-2999), Platinum (3000+). Вищий рівень = швидше накопичення!</span>
          </li>
        </ul>
      </div>
    </div>
  )
}function getSegmentCenter(prizes: Prize[], idx: number): number {
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
        import { useAuthStore } from '../stores/auth'

export default function BonusesPage() {
  const { user } = useAuthStore()

  return (
    <div className="p-4 pb-24">
      <h1 className="text-2xl font-bold mb-4 text-coffee-800">Лояльність</h1>
      
      <div className="bg-white p-5 rounded-2xl shadow-sm mb-4 border border-coffee-100 flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">Ваш рівень</p>
          <p className="text-2xl font-bold text-coffee-600">{user?.level || 'Bronze'}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-sm">Баланс</p>
          <p className="text-2xl font-bold text-coffee-600">{user?.points || 0}</p>
        </div>
      </div>

      <div className="bg-coffee-50 p-6 rounded-2xl shadow-inner mb-4 text-center border border-coffee-200">
        <h2 className="text-xl font-bold mb-2">Колесо Фортуни 🎡</h2>
        <p className="text-sm text-gray-600 mb-5">Крути колесо та отримуй подарунки! 1 спін = кожні 5 замовлень.</p>
        <button className="bg-coffee-600 text-white px-8 py-3 rounded-full font-bold shadow-md active:scale-95 transition-transform">
          Крутити (Доступно: 0)
        </button>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-bold mb-3 text-gray-800">Як працюють бонуси?</h3>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-coffee-500 mt-0.5">•</span>
            <span>Отримуй <b>1 бал</b> за кожні 5 грн у чеку.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-coffee-500 mt-0.5">•</span>
            <span>Оплачуй балами до <b>20%</b> вартості (1 бал = 1 грн).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-coffee-500 mt-0.5">•</span>
            <span><b>Рівні:</b> Bronze (0-299), Silver (300-999), Gold (1000-2999), Platinum (3000+). Вищий рівень = швидше накопичення!</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
