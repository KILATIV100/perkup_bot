import { useState } from 'react'
import { authApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { useLocationStore } from '../stores/location'
import { useT } from '../lib/i18n'

export default function TestPanel() {
  const { user, updateUser, logout } = useAuthStore()
  const { activeLocation } = useLocationStore()
  const [loading, setLoading] = useState('')
  const [result, setResult] = useState('')
  const [orderCount, setOrderCount] = useState(5)
  const [pointsValue, setPointsValue] = useState(500)
  const t = useT()

  if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN')) return null

  const handleReset = async () => {
    if (!confirm(t('test.resetConfirm'))) return
    setLoading('reset')
    setResult('')
    try {
      const res = await authApi.testReset()
      const { token, user: u } = res.data
      localStorage.setItem('perkup_token', token)
      updateUser(u)
      setResult('✅ Скинуто! Перезавантаження...')
      setTimeout(() => window.location.reload(), 800)
    } catch (e: any) {
      setResult('❌ ' + (e.response?.data?.error || e.message))
    } finally {
      setLoading('')
    }
  }

  const handleAddOrders = async () => {
    setLoading('orders')
    setResult('')
    try {
      const res = await authApi.testAddOrders(orderCount, activeLocation?.slug)
      const d = res.data
      setResult(`✅ +${d.ordersCreated} замовлень, +${d.pointsAdded} балів (всього: ${d.totalPoints} б., ${d.totalOrders} зам.)`)
      // Refresh user
      const me = await authApi.getMe()
      updateUser(me.data.user)
    } catch (e: any) {
      setResult('❌ ' + (e.response?.data?.error || e.message))
    } finally {
      setLoading('')
    }
  }

  const handleSetPoints = async () => {
    setLoading('points')
    setResult('')
    try {
      const res = await authApi.testSetPoints(pointsValue)
      setResult(`✅ Бали: ${res.data.points}, рівень: ${res.data.level}`)
      const me = await authApi.getMe()
      updateUser(me.data.user)
    } catch (e: any) {
      setResult('❌ ' + (e.response?.data?.error || e.message))
    } finally {
      setLoading('')
    }
  }

  return (
    <div className="bg-amber-50 rounded-2xl border-2 border-amber-300 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🧪</span>
        <h3 className="font-bold text-amber-800">{t('test.title')}</h3>
      </div>

      <p className="text-xs text-amber-700">
        Поточний стан: <b>{user.points}</b> балів · <b>{user.level}</b> · онбординг: {user.onboardingDone ? '✅' : '❌'}
      </p>

      {/* Full Reset */}
      <button
        onClick={handleReset}
        disabled={!!loading}
        className="w-full py-2.5 rounded-xl bg-red-500 text-white font-semibold text-sm disabled:opacity-50 active:scale-95 transition-transform"
      >
        {loading === 'reset' ? '⏳ ...' : `🔄 ${t('test.reset')}`}
      </button>

      {/* Add Orders */}
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          max={50}
          value={orderCount}
          onChange={(e) => setOrderCount(Number(e.target.value))}
          className="w-16 px-2 py-2 border border-amber-300 rounded-xl text-center text-sm bg-white"
        />
        <button
          onClick={handleAddOrders}
          disabled={!!loading}
          className="flex-1 py-2 rounded-xl bg-green-500 text-white font-semibold text-sm disabled:opacity-50 active:scale-95 transition-transform"
        >
          {loading === 'orders' ? '⏳...' : `➕ ${t('test.addOrders', { n: orderCount })}`}
        </button>
      </div>

      {/* Set Points */}
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          max={100000}
          value={pointsValue}
          onChange={(e) => setPointsValue(Number(e.target.value))}
          className="w-20 px-2 py-2 border border-amber-300 rounded-xl text-center text-sm bg-white"
        />
        <button
          onClick={handleSetPoints}
          disabled={!!loading}
          className="flex-1 py-2 rounded-xl bg-blue-500 text-white font-semibold text-sm disabled:opacity-50 active:scale-95 transition-transform"
        >
          {loading === 'points' ? '⏳...' : `🎯 ${t('test.setPoints', { n: pointsValue })}`}
        </button>
      </div>

      {/* Quick presets */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { label: 'Bronze', pts: 50 },
          { label: 'Silver', pts: 300 },
          { label: 'Gold', pts: 1000 },
          { label: 'Platinum', pts: 3000 },
        ].map((p) => (
          <button
            key={p.label}
            onClick={() => setPointsValue(p.pts)}
            className="px-2.5 py-1 text-xs rounded-lg bg-amber-200 text-amber-800 font-medium active:scale-95"
          >
            {p.label} ({p.pts})
          </button>
        ))}
      </div>

      {result && (
        <div className="text-sm text-amber-900 bg-amber-100 rounded-xl px-3 py-2 break-words">
          {result}
        </div>
      )}
    </div>
  )
}
