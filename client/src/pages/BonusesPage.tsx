import { useState } from 'react'
import { loyaltyApi } from '../lib/api'

export default function BonusesPage() {
  const [result, setResult] = useState<string>('')
  const [link, setLink] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const spin = async () => {
    setLoading(true)
    try {
      const res = await loyaltyApi.spin(0, 0)
      setResult(res.data.message || `+${res.data.reward}`)
    } catch (e: any) {
      setResult(e?.response?.data?.error || 'Не вдалося виконати спін')
    } finally {
      setLoading(false)
    }
  }

  const getReferral = async () => {
    try {
      const res = await loyaltyApi.getReferralLink()
      setLink(res.data.referral?.link || '')
    } catch (e: any) {
      setResult(e?.response?.data?.error || 'Не вдалося отримати реферальне посилання')
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold text-coffee-700">🎡 Бонуси</h1>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
        <div className="font-semibold">Колесо фортуни</div>
        <button onClick={spin} disabled={loading} className="px-4 py-2 rounded-xl bg-coffee-600 text-white disabled:opacity-60">
          {loading ? 'Крутимо...' : 'Крутити зараз'}
        </button>
        {result && <div className="text-sm text-gray-700">{result}</div>}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
        <div className="font-semibold">Реферальна система</div>
        <button onClick={getReferral} className="px-4 py-2 rounded-xl bg-coffee-100 text-coffee-700">
          Отримати посилання
        </button>
        {link && <div className="text-sm break-all text-gray-700">{link}</div>}
      </div>
    </div>
  )
}
