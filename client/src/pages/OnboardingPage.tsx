import { useState } from 'react'
import { authApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'

export default function OnboardingPage() {
  const { updateUser } = useAuthStore()
  const [language, setLanguage] = useState<'uk' | 'en'>('uk')
  const [birthDate, setBirthDate] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      await authApi.completeOnboarding({ language, birthDate: birthDate || undefined })
      updateUser({ onboardingDone: true, language })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-coffee-50 p-4 flex items-center">
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h1 className="text-xl font-bold text-coffee-700">Ласкаво просимо до PerkUp ☕</h1>
        <p className="text-sm text-gray-600">Заверши швидкий онбординг, щоб продовжити.</p>

        <div>
          <label className="text-sm font-medium">Мова</label>
          <div className="mt-2 flex gap-2">
            <button onClick={() => setLanguage('uk')} className={`px-3 py-2 rounded-xl border ${language === 'uk' ? 'bg-coffee-600 text-white' : 'bg-white'}`}>🇺🇦 УКР</button>
            <button onClick={() => setLanguage('en')} className={`px-3 py-2 rounded-xl border ${language === 'en' ? 'bg-coffee-600 text-white' : 'bg-white'}`}>🇬🇧 ENG</button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Дата народження (опційно)</label>
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="mt-2 w-full border rounded-xl px-3 py-2" />
        </div>

        <button disabled={saving} onClick={submit} className="w-full px-4 py-2 rounded-xl bg-coffee-600 text-white disabled:opacity-60">
          {saving ? 'Зберігаємо...' : 'Продовжити'}
        </button>
      </div>
    </div>
  )
}
