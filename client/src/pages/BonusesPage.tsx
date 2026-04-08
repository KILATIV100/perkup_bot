import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '../stores/auth'
import { loyaltyApi } from '../lib/api'
import FortuneWheel, { WheelPrize } from '../components/FortuneWheel'
import { useT } from '../lib/i18n'

interface Voucher {
  id: number
  code: string
  prizeLabel: string
  prizeType: string
  expiresAt: string
}

interface Transaction {
  id: number
  amount: number
  type: string
  description: string
  createdAt: string
}

interface LoyaltyStatus {
  points: number
  level: string
  multiplier: number
  nextLevel: { name: string; required: number } | null
  spinsAvailable: number
  completedOrders: number
  vouchers: Voucher[]
  transactions: Transaction[]
}

const LEVEL_COLORS: Record<string, string> = {
  Bronze: 'from-amber-700 to-amber-600',
  Silver: 'from-gray-400 to-gray-300',
  Gold: 'from-yellow-500 to-amber-400',
  Platinum: 'from-indigo-400 to-purple-400',
}

const LEVEL_EMOJIS: Record<string, string> = {
  Bronze: '🥉',
  Silver: '🥈',
  Gold: '🥇',
  Platinum: '💎',
}

export default function BonusesPage() {
  const { user } = useAuthStore()
  const [status, setStatus] = useState<LoyaltyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [prizes, setPrizes] = useState<WheelPrize[]>([])

  // Spin state
  const [spinning, setSpinning] = useState(false)
  const [targetIndex, setTargetIndex] = useState<number | null>(null)
  const [spinResult, setSpinResult] = useState<{
    prize: WheelPrize; voucherCode: string | null
  } | null>(null)
  const [showResult, setShowResult] = useState(false)
  const t = useT()

  const loadStatus = useCallback(async () => {
    try {
      const [statusRes, prizesRes] = await Promise.all([
        loyaltyApi.getStatus(),
        loyaltyApi.getPrizes(),
      ])
      setStatus(statusRes.data)
      setPrizes(prizesRes.data.prizes || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  const handleSpin = async () => {
    if (spinning || !status || status.spinsAvailable <= 0) return
    setSpinning(true)
    setSpinResult(null)
    setShowResult(false)
    try {
      const res = await loyaltyApi.spin()
      const data = res.data
      setTargetIndex(data.prizeIndex)
      setSpinResult({ prize: data.prize, voucherCode: data.voucherCode })
    } catch {
      setSpinning(false)
    }
  }

  const handleSpinEnd = useCallback(() => {
    setSpinning(false)
    setShowResult(true)
    // Refresh status after spin
    loadStatus()
  }, [loadStatus])

  const dismissResult = () => {
    setShowResult(false)
    setSpinResult(null)
    setTargetIndex(null)
  }

  if (loading) {
    return (
      <div className="p-4 pb-24 space-y-4">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-32 rounded-2xl" />
      </div>
    )
  }

  const level = status?.level || 'Bronze'
  const nextLevel = status?.nextLevel
  const progress = nextLevel
    ? ((status?.points || 0) / nextLevel.required) * 100
    : 100

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Level Card */}
      <div className={`bg-gradient-to-r ${LEVEL_COLORS[level] || LEVEL_COLORS.Bronze} p-5 rounded-2xl shadow-md text-white`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white/70 text-xs font-medium">{t('bonuses.level')}</p>
            <p className="text-2xl font-bold">{LEVEL_EMOJIS[level]} {level}</p>
          </div>
          <div className="text-right">
            <p className="text-white/70 text-xs font-medium">{t('bonuses.balance')}</p>
            <p className="text-3xl font-bold">{status?.points || 0}</p>
          </div>
        </div>

        {nextLevel && (
          <div>
            <div className="flex justify-between text-xs text-white/80 mb-1">
              <span>{t('bonuses.nextLevel')} {nextLevel.name}</span>
              <span>{status?.points || 0} / {nextLevel.required}</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-2">
              <div
                className="bg-white h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        )}
        {!nextLevel && (
          <p className="text-white/80 text-xs">{t('profile.maxLevel')} x{status?.multiplier} {t('bonuses.multiplier').toLowerCase()}</p>
        )}

        <div className="flex gap-3 mt-3">
          <div className="bg-white/15 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-white/60">{t('bonuses.multiplier')}: </span>
            <span className="font-bold">x{status?.multiplier}</span>
          </div>
          <div className="bg-white/15 rounded-xl px-3 py-1.5 text-xs">
            <span className="text-white/60">{t('bonuses.orders')}: </span>
            <span className="font-bold">{status?.completedOrders || 0}</span>
          </div>
        </div>
      </div>

      {/* Fortune Wheel */}
      <div className="bg-coffee-50 rounded-2xl border border-coffee-200 p-4">
        <h2 className="text-lg font-bold text-center text-coffee-800 mb-1">{t('bonuses.spinTitle')}</h2>
        <p className="text-xs text-center text-gray-500 mb-3">
          Спінів: <b className="text-coffee-600">{status?.spinsAvailable || 0}</b> · 1 спін = кожні 5 замовлень
        </p>

        {prizes.length > 0 && (
          <FortuneWheel
            prizes={prizes}
            spinning={spinning}
            targetIndex={targetIndex}
            onSpinEnd={handleSpinEnd}
          />
        )}

        <button
          onClick={handleSpin}
          disabled={spinning || !status || status.spinsAvailable <= 0}
          className={`mt-3 w-full py-3 rounded-xl font-bold text-lg transition-all active:scale-[0.98] ${
            status && status.spinsAvailable > 0 && !spinning
              ? 'bg-coffee-600 text-white shadow-lg hover:bg-coffee-700'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {spinning ? t('bonuses.spinning') : `${t('bonuses.spin')} (${status?.spinsAvailable || 0})`}
        </button>
      </div>

      {/* Spin Result Modal */}
      {showResult && spinResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={dismissResult}>
          <div
            className="bg-white rounded-2xl p-6 mx-4 max-w-xs w-full text-center animate-bounce-in shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-5xl mb-3">{spinResult.prize.emoji}</div>
            <h3 className="text-xl font-bold text-coffee-800 mb-1">
              {spinResult.prize.type === 'nothing' ? t('bonuses.noLuck') : t('bonuses.congrats')}
            </h3>
            <p className="text-gray-600 mb-3">{spinResult.prize.label}</p>
            {spinResult.voucherCode && (
              <div className="bg-coffee-50 border border-coffee-200 rounded-xl p-3 mb-3">
                <p className="text-xs text-gray-500">{t('bonuses.yourCode')}</p>
                <p className="text-2xl font-mono font-bold text-coffee-600 tracking-wider">
                  {spinResult.voucherCode}
                </p>
                <p className="text-xs text-gray-400 mt-1">{t('bonuses.valid7days')} · {t('bonuses.showBarista')}</p>
              </div>
            )}
            <button
              onClick={dismissResult}
              className="w-full bg-coffee-600 text-white py-3 rounded-xl font-bold active:scale-[0.98] transition-transform"
            >
              {t('bonuses.great')}
            </button>
          </div>
        </div>
      )}

      {/* Active Vouchers */}
      {status && status.vouchers.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h3 className="font-bold text-gray-800 mb-3">{t('bonuses.activeVouchers')}</h3>
          <div className="space-y-2">
            {status.vouchers.map(v => (
              <div key={v.id} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex-1">
                  <p className="font-bold text-sm text-gray-800">{v.prizeLabel}</p>
                  <p className="text-xs text-gray-400">
                    До {new Date(v.expiresAt).toLocaleDateString('uk-UA')}
                  </p>
                </div>
                <div className="bg-white border border-amber-300 rounded-lg px-3 py-1">
                  <span className="font-mono font-bold text-coffee-600 text-sm">{v.code}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {status && status.transactions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <h3 className="font-bold text-gray-800 mb-3">{t('bonuses.history')}</h3>
          <div className="space-y-2">
            {status.transactions.slice(0, 6).map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm text-gray-700">{t.description}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(t.createdAt).toLocaleDateString('uk-UA')}
                  </p>
                </div>
                <span className={`font-bold text-sm ${t.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {t.amount > 0 ? '+' : ''}{t.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-bold mb-3 text-gray-800">{t('bonuses.howItWorks')}</h3>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-coffee-500 mt-0.5">•</span>
            <span>{t('bonuses.faq1')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-coffee-500 mt-0.5">•</span>
            <span>{t('bonuses.faq2')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-coffee-500 mt-0.5">•</span>
            <span>{t('bonuses.faq3')}</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
