import { useState } from 'react'
import { authApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { useT } from '../lib/i18n'

export default function OnboardingPage() {
  const { updateUser } = useAuthStore()
  const [language, setLanguage] = useState<'uk' | 'en'>('uk')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [saving, setSaving] = useState(false)
  const t = useT()

  const submit = async () => {
    setSaving(true)
    try {
      await authApi.completeOnboarding({ language, phone: phone || undefined, birthDate: birthDate || undefined })
      updateUser({ onboardingDone: true, language, phone: phone || null })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-coffee-50 p-4 flex items-center">
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
        <h1 className="text-xl font-bold text-coffee-700">{t('onboarding.welcome')}</h1>
        <p className="text-sm text-gray-600">{t('onboarding.subtitle')}</p>

        <div>
          <label className="text-sm font-medium">{t('onboarding.language')}</label>
          <div className="mt-2 flex gap-2">
            <button onClick={() => setLanguage('uk')} className={`px-3 py-2 rounded-xl border ${language === 'uk' ? 'bg-coffee-600 text-white' : 'bg-white'}`}>🇺🇦 УКР</button>
            <button onClick={() => setLanguage('en')} className={`px-3 py-2 rounded-xl border ${language === 'en' ? 'bg-coffee-600 text-white' : 'bg-white'}`}>🇬🇧 ENG</button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">{t('onboarding.phone')}</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-2 w-full border rounded-xl px-3 py-2" placeholder="+380501234567" />
        </div>

        <div>
          <label className="text-sm font-medium">{t('onboarding.birthday')}</label>
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="mt-2 w-full border rounded-xl px-3 py-2" />
        </div>

        <button disabled={saving} onClick={submit} className="w-full px-4 py-2 rounded-xl bg-coffee-600 text-white disabled:opacity-60">
          {saving ? t('onboarding.saving') : t('onboarding.submit')}
        </button>
      </div>
    </div>
  )
}
