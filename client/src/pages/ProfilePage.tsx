import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { loyaltyApi, ordersApi } from '../lib/api'
import TestPanel from '../components/TestPanel'
import { useT } from '../lib/i18n'

const LEVELS = [
  { name: 'BRONZE', label: 'Bronze', threshold: 0, emoji: '🥉', gradient: 'from-amber-700 to-amber-500', ring: 'ring-amber-400', bg: 'bg-amber-50', text: 'text-amber-800', bar: 'bg-amber-500' },
  { name: 'SILVER', label: 'Silver', threshold: 300, emoji: '🥈', gradient: 'from-gray-500 to-gray-300', ring: 'ring-gray-300', bg: 'bg-gray-50', text: 'text-gray-700', bar: 'bg-gray-400' },
  { name: 'GOLD', label: 'Gold', threshold: 1000, emoji: '🥇', gradient: 'from-yellow-500 to-amber-400', ring: 'ring-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-800', bar: 'bg-yellow-500' },
  { name: 'PLATINUM', label: 'Platinum', threshold: 3000, emoji: '💎', gradient: 'from-indigo-500 to-purple-400', ring: 'ring-purple-400', bg: 'bg-purple-50', text: 'text-purple-800', bar: 'bg-purple-500' },
]

function getLevelInfo(levelName: string) {
  return LEVELS.find(l => l.name === levelName) || LEVELS[0]
}

function getNextLevel(levelName: string) {
  const idx = LEVELS.findIndex(l => l.name === levelName)
  return idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const [stats, setStats] = useState<{ completedOrders: number; spinsAvailable: number; vouchers: any[] } | null>(null)
  const [referralLink, setReferralLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [orders, setOrders] = useState<any[]>([])

  const loadStats = useCallback(async () => {
    try {
      const res = await loyaltyApi.getStatus()
      setStats({
        completedOrders: res.data.completedOrders ?? 0,
        spinsAvailable: res.data.spinsAvailable ?? 0,
        vouchers: res.data.vouchers ?? [],
      })
    } catch { /* ignore */ }
  }, [])

  const loadReferral = useCallback(async () => {
    try {
      const res = await loyaltyApi.getReferralLink()
      setReferralLink(res.data.link || res.data.referralLink || null)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadStats(); loadReferral() }, [loadStats, loadReferral])

  useEffect(() => {
    ordersApi.getMyOrders().then(r => setOrders(r.data.orders?.slice(0, 3) || [])).catch(() => {})
  }, [])

  const level = getLevelInfo(user?.level || 'BRONZE')
  const next = getNextLevel(user?.level || 'BRONZE')
  const points = user?.points ?? 0
  const progress = next ? Math.min(100, Math.round(((points - level.threshold) / (next.threshold - level.threshold)) * 100)) : 100

  const copyReferral = async () => {
    if (!referralLink) return
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  const handleLogout = () => {
    setShowLogoutConfirm(false)
    logout()
  }

  const isStaff = user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'BARISTA'
  const t = useT()

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Level card */}
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${level.gradient} p-5 text-white shadow-lg`}>
        <div className="absolute -right-6 -top-6 text-[120px] opacity-10 leading-none select-none">{level.emoji}</div>
        <div className="relative z-10 flex items-center gap-4">
          <div className={`w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl ring-4 ${level.ring} ring-offset-2 ring-offset-transparent`}>
            {level.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-bold truncate">{user?.firstName || t('common.guest')}</div>
            <div className="text-sm opacity-90 mt-0.5">{level.label} {t('profile.level')}</div>
            {user?.phone && <div className="text-xs opacity-75 mt-1">📞 {user.phone}</div>}
      {!user?.phone && (
        <div className="mt-2">
          <a href="#/settings" className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full font-medium">
            ⚠️ Вкажіть телефон для офлайн балів →
          </a>
        </div>
      )}
          </div>
        </div>

        {/* Progress bar to next level */}
        <div className="mt-5 relative z-10">
          {next ? (
            <>
              <div className="flex justify-between text-xs opacity-80 mb-1.5">
                <span>{points} {t('profile.points')}</span>
                <span>{next.emoji} {next.label} — {next.threshold} {t('profile.points')}</span>
              </div>
              <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white/80 rounded-full transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-xs opacity-70 mt-1 text-center">
                {next.threshold - points > 0 ? t('profile.pointsTo', { n: next.threshold - points, level: next.label }) : t('profile.almostNext')}
              </div>
            </>
          ) : (
            <div className="text-center text-sm opacity-80">
              🏆 {t('profile.maxLevel')} · {points} {t('profile.points')}
            </div>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`${level.bg} rounded-2xl p-3 text-center shadow-sm border border-white`}>
          <div className="text-2xl font-bold text-gray-800">{stats?.completedOrders ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">{t('profile.orders')}</div>
        </div>
        <div className={`${level.bg} rounded-2xl p-3 text-center shadow-sm border border-white`}>
          <div className="text-2xl font-bold text-gray-800">{stats?.spinsAvailable ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">{t('profile.spins')}</div>
        </div>
        <div className={`${level.bg} rounded-2xl p-3 text-center shadow-sm border border-white`}>
          <div className="text-2xl font-bold text-gray-800">{stats?.vouchers?.length ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">{t('profile.vouchers')}</div>
        </div>
      </div>

      {/* Recent orders */}
      {orders.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-700">Останні замовлення</div>
          {orders.map((o: any) => (
            <div key={o.id} onClick={() => navigate('/orders/' + o.id)}
              className="flex justify-between items-center px-4 py-3 border-b border-gray-50 last:border-0 active:bg-gray-50 cursor-pointer">
              <div>
                <div className="text-sm font-medium text-gray-900">Замовлення #{o.id}</div>
                <div className="text-xs text-gray-400">{o.location?.name} · {o.items?.length} позиції</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-coffee-700">{Number(o.total).toFixed(0)} грн</div>
                <div className="text-xs text-gray-400">{o.status}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Menu items */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {(stats?.completedOrders ?? 0) === 0 && (
          <button onClick={() => navigate('/onboarding')} className="w-full text-left px-4 py-3.5 border-b border-gray-50 flex justify-between items-center active:bg-gray-50 transition-colors">
            <span className="text-gray-700 font-medium">\u2753 \u042f\u043a \u0446\u0435 \u043f\u0440\u0430\u0446\u044e\u0454</span>
            <span className="text-gray-300">›</span>
          </button>
        )}
        <button onClick={() => navigate('/bonuses')} className="w-full text-left px-4 py-3.5 border-b border-gray-50 flex justify-between items-center active:bg-gray-50 transition-colors">
          <span className="text-gray-700 font-medium">{t('profile.historyAndBonuses')}</span>
          <span className="text-gray-300">›</span>
        </button>
        <button onClick={() => navigate('/settings')} className="w-full text-left px-4 py-3.5 border-b border-gray-50 flex justify-between items-center active:bg-gray-50 transition-colors">
          <span className="text-gray-700 font-medium">{t('profile.settings')}</span>
          <span className="text-gray-300">›</span>
        </button>
        {isStaff && (
          <button onClick={() => navigate('/admin')} className="w-full text-left px-4 py-3.5 flex justify-between items-center active:bg-gray-50 transition-colors">
            <span className="text-gray-700 font-medium">{t('profile.admin')}</span>
            <span className="text-gray-300">›</span>
          </button>
        )}
      </div>

      {/* Referral banner */}
      {referralLink && (
        <div className="bg-gradient-to-r from-coffee-100 to-amber-50 rounded-2xl p-4 shadow-sm border border-coffee-200">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🎯</span>
            <span className="font-semibold text-coffee-800">{t('profile.referral')}</span>
          </div>
          <p className="text-sm text-coffee-700 mb-3">{t('profile.referralDesc')}</p>
          <button onClick={copyReferral} className="w-full py-2.5 rounded-xl bg-coffee-700 text-white text-sm font-semibold active:scale-[0.98] transition-transform">
            {copied ? t('common.copied') : t('profile.copyLink')}
          </button>
        </div>
      )}

      <TestPanel />

      {/* Logout */}
      {!showLogoutConfirm ? (
        <button onClick={() => setShowLogoutConfirm(true)} className="w-full py-3 text-red-500 font-semibold bg-red-50 rounded-xl active:scale-95 transition-transform">
          {t('profile.logout')}
        </button>
      ) : (
        <div className="bg-red-50 rounded-2xl p-4 border border-red-200 space-y-3">
          <p className="text-sm text-red-800 font-medium text-center">{t('profile.logoutConfirm')}</p>
          <div className="flex gap-3">
            <button onClick={handleLogout} className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl active:scale-95 transition-transform">
              {t('profile.logoutYes')}
            </button>
            <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-2.5 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 active:scale-95 transition-transform">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
