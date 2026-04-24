import { useState } from 'react'
import { authApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { useT } from '../lib/i18n'

export default function OnboardingPage() {
  const { updateUser } = useAuthStore()
  const [language, setLanguage]   = useState<'uk' | 'en'>('uk')
  const [phone, setPhone]         = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [saving, setSaving]       = useState(false)
  const [phoneShared, setPhoneShared] = useState(false)
  const [step, setStep]           = useState<'lang' | 'phone' | 'birth' | 'done'>('lang')
  const t = useT()

  const tg = window.Telegram?.WebApp

  // Запит телефону через Telegram WebApp
  const requestTelegramPhone = () => {
    if (!tg) return
    try {
      tg.requestContact((granted: boolean, contact: any) => {
        if (granted && contact?.phoneNumber) {
          const p = contact.phoneNumber.startsWith('+')
            ? contact.phoneNumber
            : '+' + contact.phoneNumber
          setPhone(p)
          setPhoneShared(true)
        }
      })
    } catch {
      // Старіші версії WebApp не підтримують requestContact
    }
  }

  const submit = async () => {
    setSaving(true)
    try {
      await authApi.completeOnboarding({
        language,
        phone: phone || undefined,
        birthDate: birthDate || undefined,
      })
      updateUser({ onboardingDone: true, language, phone: phone || null })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1c0a02] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">☕</div>
          <h1 className="text-white text-2xl font-black tracking-tight">PerkUp</h1>
          <p className="text-amber-300/70 text-sm mt-1">Кавова програма лояльності</p>
        </div>

        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">

          {/* Progress bar */}
          <div className="h-1 bg-stone-100">
            <div
              className="h-full bg-amber-500 transition-all duration-500"
              style={{ width: step === 'lang' ? '25%' : step === 'phone' ? '60%' : step === 'birth' ? '85%' : '100%' }}
            />
          </div>

          <div className="p-6 space-y-5">

            {/* STEP 1: Мова */}
            {step === 'lang' && (
              <>
                <div>
                  <h2 className="text-xl font-bold text-stone-800">Вітаємо у PerkUp! 👋</h2>
                  <p className="text-stone-500 text-sm mt-1">Обери мову інтерфейсу</p>
                </div>
                <div className="flex gap-3">
                  {[['uk','🇺🇦 Українська'],['en','🇬🇧 English']].map(([l, label]) => (
                    <button key={l} onClick={() => setLanguage(l as 'uk'|'en')}
                      className={`flex-1 py-3 rounded-2xl border-2 text-sm font-semibold transition-all ${
                        language === l
                          ? 'border-amber-500 bg-amber-50 text-amber-800'
                          : 'border-stone-200 text-stone-600'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setStep('phone')}
                  className="w-full py-4 rounded-2xl bg-amber-800 text-white font-bold text-base active:scale-95 transition-transform">
                  Далі →
                </button>
              </>
            )}

            {/* STEP 2: Телефон */}
            {step === 'phone' && (
              <>
                <div>
                  <h2 className="text-xl font-bold text-stone-800">📞 Номер телефону</h2>
                  <p className="text-stone-500 text-sm mt-1">
                    Потрібен щоб нараховувати бали коли ти купуєш каву офлайн — баристи знайдуть тебе за номером
                  </p>
                </div>

                {/* Кнопка через Telegram */}
                {tg && (
                  <button onClick={requestTelegramPhone}
                    className={`w-full py-3.5 rounded-2xl border-2 flex items-center justify-center gap-2 font-semibold transition-all ${
                      phoneShared
                        ? 'border-green-400 bg-green-50 text-green-700'
                        : 'border-stone-300 bg-white text-stone-700 active:bg-stone-50'
                    }`}>
                    {phoneShared ? (
                      <><span>✅</span><span>{phone}</span></>
                    ) : (
                      <><span>📱</span><span>Поділитись через Telegram</span></>
                    )}
                  </button>
                )}

                {/* Або вручну */}
                <div className="relative">
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-stone-200" />
                  <span className="relative bg-white px-3 mx-auto block w-fit text-xs text-stone-400">або вручну</span>
                </div>

                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setPhoneShared(false) }}
                  className="w-full border-2 border-stone-200 rounded-2xl px-4 py-3 text-base focus:border-amber-400 focus:outline-none transition-colors"
                  placeholder="+380501234567"
                  inputMode="tel"
                />

                <div className="flex gap-2">
                  <button onClick={() => setStep('lang')}
                    className="px-5 py-3 rounded-2xl bg-stone-100 text-stone-600 font-semibold active:scale-95 transition-transform">
                    ←
                  </button>
                  <button onClick={() => setStep('birth')}
                    className="flex-1 py-3 rounded-2xl bg-amber-800 text-white font-bold active:scale-95 transition-transform">
                    {phone ? 'Далі →' : 'Пропустити →'}
                  </button>
                </div>

                {!phone && (
                  <p className="text-xs text-stone-400 text-center">
                    ⚠️ Без телефону бали за офлайн покупки не нараховуватимуться автоматично
                  </p>
                )}
              </>
            )}

            {/* STEP 3: День народження */}
            {step === 'birth' && (
              <>
                <div>
                  <h2 className="text-xl font-bold text-stone-800">🎂 День народження</h2>
                  <p className="text-stone-500 text-sm mt-1">
                    Отримай подарунок у свій день народження — безкоштовне замовлення!
                  </p>
                </div>

                <input
                  type="date"
                  value={birthDate}
                  onChange={e => setBirthDate(e.target.value)}
                  className="w-full border-2 border-stone-200 rounded-2xl px-4 py-3 text-base focus:border-amber-400 focus:outline-none transition-colors"
                />

                <div className="flex gap-2">
                  <button onClick={() => setStep('phone')}
                    className="px-5 py-3 rounded-2xl bg-stone-100 text-stone-600 font-semibold active:scale-95 transition-transform">
                    ←
                  </button>
                  <button onClick={submit} disabled={saving}
                    className="flex-1 py-3 rounded-2xl bg-amber-800 text-white font-bold active:scale-95 transition-transform disabled:opacity-60">
                    {saving ? 'Зберігаємо...' : '🚀 Почати!'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Benefits */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[['☕','Бали\nза каву'],['🎁','Подарунки\nта знижки'],['🏆','Рівні\nлояльності']].map(([e,t]) => (
            <div key={e} className="bg-white/10 rounded-2xl p-3">
              <div className="text-2xl">{e}</div>
              <p className="text-white/70 text-xs mt-1 whitespace-pre-line">{t}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
