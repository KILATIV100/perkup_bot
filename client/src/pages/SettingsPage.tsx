import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { authApi } from '../lib/api'
import { useT } from '../lib/i18n'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, updateUser } = useAuthStore()

  const [language, setLanguage] = useState<'uk' | 'en'>((user?.language as 'uk' | 'en') || 'uk')
  const [phone, setPhone] = useState(user?.phone || '')
  const [notifSpin, setNotifSpin] = useState(true)
  const [notifMorning, setNotifMorning] = useState(true)
  const [notifPromo, setNotifPromo] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const t = useT()

  const handleLanguage = async (lang: 'uk' | 'en') => {
    setLanguage(lang)
    setSaving(true)
    try {
      await authApi.updateSettings({ language: lang })
      updateUser({ language: lang })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  const handleToggle = async (field: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value)
    try {
      await authApi.updateSettings({ [field]: value })
    } catch {
      setter(!value)
    }
  }

  const handlePhoneSave = async () => {
    setSaving(true)
    try {
      await authApi.updateSettings({ phone: phone || '' })
      updateUser({ phone: phone || null })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/profile')} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-100 shadow-sm active:scale-95 transition-transform">
          ←
        </button>
        <h1 className="text-2xl font-bold text-coffee-800">{t('settings.title')}</h1>
      </div>

      {/* Language */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🌐</span>
          <h2 className="font-semibold text-gray-800">Мова / Language</h2>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleLanguage('uk')}
            disabled={saving}
            className={`py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
              language === 'uk'
                ? 'bg-coffee-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            🇺🇦 Українська
          </button>
          <button
            onClick={() => handleLanguage('en')}
            disabled={saving}
            className={`py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
              language === 'en'
                ? 'bg-coffee-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            🇬🇧 English
          </button>
        </div>

        {saved && (
          <p className="text-xs text-green-600 text-center">✅ {t('settings.languageSaved')}</p>
        )}
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-1">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔔</span>
          <h2 className="font-semibold text-gray-800">{t('settings.notifications')}</h2>
        </div>

        <Toggle
          label={t('settings.notifSpin')}
          icon="🎰"
          value={notifSpin}
          onChange={(v) => handleToggle('notifSpin', v, setNotifSpin)}
        />
        <Toggle
          label={t('settings.notifMorning')}
          icon="☀️"
          value={notifMorning}
          onChange={(v) => handleToggle('notifMorning', v, setNotifMorning)}
        />
        <Toggle
          label={t('settings.notifPromo')}
          icon="🏷️"
          value={notifPromo}
          onChange={(v) => handleToggle('notifPromo', v, setNotifPromo)}
        />
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">👤</span>
          <h2 className="font-semibold text-gray-800">{t('settings.account')}</h2>
        </div>

        <div className="space-y-2 pb-2 border-b border-gray-100 mb-2">
          <label className="text-sm text-gray-500">{t('settings.phone')}</label>
          <div className="flex gap-2">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="+380501234567" inputMode="tel" />
            <button onClick={handlePhoneSave} disabled={saving} className="px-4 py-2 rounded-xl bg-coffee-600 text-white text-sm disabled:opacity-60">
              {t('common.save')}
            </button>
          </div>
        </div>

        <InfoRow label={t('settings.name')} value={user?.firstName || '—'} />
        {user?.username && <InfoRow label="Username" value={`@${user.username}`} />}
        <InfoRow label={t('settings.phone')} value={user?.phone || '—'} />
        <InfoRow label={t('settings.level')} value={user?.level || 'BRONZE'} />
        <InfoRow label={t('settings.pointsLabel')} value={String(user?.points || 0)} />
      </div>
    </div>
  )
}

function Toggle({ label, icon, value, onChange }: { label: string; icon: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between py-3 px-1 active:bg-gray-50 rounded-lg transition-colors"
    >
      <span className="flex items-center gap-2 text-sm text-gray-700">
        <span>{icon}</span>
        {label}
      </span>
      <div className={`w-11 h-6 rounded-full relative transition-colors ${value ? 'bg-coffee-500' : 'bg-gray-300'}`}>
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5.5 left-[1px]' : 'left-[2px]'}`}
          style={{ transform: value ? 'translateX(21px)' : 'translateX(0)' }}
        />
      </div>
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  )
}
