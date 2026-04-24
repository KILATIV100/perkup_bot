import { useState, useRef, useEffect } from 'react'
import { adminApi, shiftsApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { useNavigate } from 'react-router-dom'
import { FEATURES } from '../lib/features'

export default function BaristaPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const phoneRef = useRef<HTMLInputElement>(null)

  const [phone, setPhone]       = useState('')
  const [check, setCheck]       = useState('')       // сума чеку
  const [foundUser, setFoundUser] = useState<any>(null)
  const [searching, setSearching] = useState(false)
  const [awarding, setAwarding] = useState(false)
  const [toast, setToast]       = useState<{text:string; ok:boolean}|null>(null)
  const [shiftStats, setShiftStats] = useState<any>(null)
  const [shiftHistory, setShiftHistory] = useState<any[]>([])
  const [shiftLoading, setShiftLoading] = useState(false)

  // Доступ лише для баристи/адмін/овнер
  useEffect(() => {
    if (user && !['BARISTA','ADMIN','OWNER'].includes(user.role)) {
      navigate('/')
    }
    phoneRef.current?.focus()
  }, [user, navigate])

  useEffect(() => {
    if (!FEATURES.SHIFT_HISTORY_ANALYTICS) return
    const load = async () => {
      setShiftLoading(true)
      try {
        const [analyticsRes, historyRes] = await Promise.all([
          shiftsApi.getAnalytics({ days: 30 }),
          shiftsApi.getHistory({ page: 1 }),
        ])
        setShiftStats(analyticsRes.data.analytics)
        setShiftHistory(historyRes.data.shifts || [])
      } catch {
        setShiftStats(null)
        setShiftHistory([])
      } finally {
        setShiftLoading(false)
      }
    }
    load()
  }, [])

  const showToast = (text: string, ok: boolean) => {
    setToast({ text, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const findClient = async () => {
    const p = phone.trim()
    if (!p) return
    setSearching(true); setFoundUser(null)
    try {
      const res = await adminApi.findUserByPhone(p)
      setFoundUser(res.data.user)
    } catch {
      showToast('Клієнта не знайдено', false)
    }
    setSearching(false)
  }

  const awardPoints = async () => {
    if (!foundUser || !check) return
    setAwarding(true)
    try {
      const res = await adminApi.awardByCheck(foundUser.phone, Number(check))
      const { pointsAwarded, user: u } = res.data
      showToast(`+${pointsAwarded} балів → ${u.firstName}`, true)
      // Скидаємо форму
      setFoundUser(null); setPhone(''); setCheck('')
      phoneRef.current?.focus()
    } catch (e: any) {
      showToast(e.response?.data?.error || 'Помилка', false)
    }
    setAwarding(false)
  }

  const LEVEL: Record<string,{label:string;color:string;emoji:string}> = {
    Bronze:   { label:'Bronze',   color:'bg-amber-100 text-amber-800',   emoji:'🥉' },
    Silver:   { label:'Silver',   color:'bg-slate-100 text-slate-700',   emoji:'🥈' },
    Gold:     { label:'Gold',     color:'bg-yellow-100 text-yellow-800', emoji:'🥇' },
    Platinum: { label:'Platinum', color:'bg-violet-100 text-violet-700', emoji:'💎' },
  }

  return (
    <div className="min-h-screen bg-stone-900 flex flex-col">

      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-white text-lg font-black">☕ Панель баристи</h1>
          <p className="text-stone-400 text-xs mt-0.5">Нарахування балів за офлайн замовлення</p>
        </div>
        <button onClick={() => navigate('/')}
          className="text-stone-500 text-sm">✕</button>
      </div>

      <div className="flex-1 px-4 space-y-3 pb-8">

        {/* Поле телефону */}
        <div className="bg-stone-800 rounded-2xl p-4 space-y-3">
          <label className="text-stone-300 text-sm font-medium">📱 Телефон клієнта</label>
          <div className="flex gap-2">
            <input
              ref={phoneRef}
              value={phone}
              onChange={e => { setPhone(e.target.value); setFoundUser(null) }}
              onKeyDown={e => e.key === 'Enter' && findClient()}
              type="tel"
              inputMode="tel"
              placeholder="+380 50 123 45 67"
              className="flex-1 bg-stone-700 text-white rounded-xl px-4 py-3.5 text-base placeholder-stone-500 border border-stone-600 focus:border-amber-500 focus:outline-none"
            />
            <button onClick={findClient} disabled={searching || !phone.trim()}
              className="bg-amber-700 text-white rounded-xl px-5 font-bold text-lg disabled:opacity-40 active:scale-95 transition-transform">
              {searching ? '⏳' : '→'}
            </button>
          </div>
        </div>

        {/* Знайдений клієнт */}
        {foundUser && (() => {
          const lvl = LEVEL[foundUser.level] || LEVEL.Bronze
          return (
            <div className="bg-stone-800 rounded-2xl p-4 space-y-4 border border-amber-700/40">
              {/* Картка клієнта */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-700 flex items-center justify-center text-white font-black text-xl">
                  {foundUser.firstName?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-bold text-lg leading-tight">
                    {foundUser.firstName} {foundUser.lastName || ''}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lvl.color}`}>
                      {lvl.emoji} {lvl.label}
                    </span>
                    <span className="text-amber-400 text-sm font-bold">⭐ {foundUser.points} б</span>
                  </div>
                </div>
              </div>

              {/* Сума чеку */}
              <div className="space-y-2">
                <label className="text-stone-300 text-sm font-medium">💳 Сума чеку (грн)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[50,80,100,150,200,250,300,500].map(n => (
                    <button key={n} onClick={() => setCheck(String(n))}
                      className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                        check === String(n)
                          ? 'bg-amber-500 text-stone-900'
                          : 'bg-stone-700 text-stone-300 active:bg-stone-600'
                      }`}>
                      {n}
                    </button>
                  ))}
                </div>
                <input
                  value={check}
                  onChange={e => setCheck(e.target.value.replace(/\D/g,''))}
                  onKeyDown={e => e.key === 'Enter' && awardPoints()}
                  placeholder="або введи суму..."
                  inputMode="numeric"
                  className="w-full bg-stone-700 text-white rounded-xl px-4 py-3 text-base placeholder-stone-500 border border-stone-600 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Попередній розрахунок балів */}
              {check && Number(check) > 0 && (() => {
                const pcts: Record<string,number> = {Bronze:1,Silver:1.25,Gold:1.5,Platinum:2}
                const pct = pcts[foundUser.level] || 1
                const estPts = Math.round(Number(check) * pct / 10)
                return (
                  <div className="bg-stone-700 rounded-xl px-4 py-2.5 flex justify-between items-center">
                    <span className="text-stone-400 text-sm">Буде нараховано:</span>
                    <span className="text-amber-400 font-black text-lg">+{estPts} балів</span>
                  </div>
                )
              })()}

              {/* Кнопка нарахування */}
              <button onClick={awardPoints} disabled={awarding || !check}
                className="w-full py-4 rounded-2xl bg-green-600 text-white font-black text-lg active:scale-95 transition-transform disabled:opacity-40 disabled:scale-100">
                {awarding ? 'Нараховуємо...' : `✅ Нарахувати → ${foundUser.firstName}`}
              </button>
            </div>
          )
        })()}

        {FEATURES.SHIFT_HISTORY_ANALYTICS && (
          <div className="bg-stone-800 rounded-2xl p-4 space-y-3 border border-stone-700">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-bold">📈 Зміни: аналітика (30 днів)</h2>
              {shiftLoading && <span className="text-xs text-stone-400">Завантаження...</span>}
            </div>

            {shiftStats ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-stone-700 rounded-xl p-2.5">
                  <div className="text-stone-400 text-xs">Змін</div>
                  <div className="text-white font-bold text-lg">{shiftStats.shiftsCount}</div>
                </div>
                <div className="bg-stone-700 rounded-xl p-2.5">
                  <div className="text-stone-400 text-xs">Замовлень</div>
                  <div className="text-white font-bold text-lg">{shiftStats.completedOrders}</div>
                </div>
                <div className="bg-stone-700 rounded-xl p-2.5">
                  <div className="text-stone-400 text-xs">Виручка</div>
                  <div className="text-white font-bold text-lg">{Math.round(shiftStats.revenue)} ₴</div>
                </div>
                <div className="bg-stone-700 rounded-xl p-2.5">
                  <div className="text-stone-400 text-xs">Чайові</div>
                  <div className="text-white font-bold text-lg">{Math.round(shiftStats.tipsTotal)} ₴</div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-stone-500">Немає даних по аналітиці.</div>
            )}

            <div className="pt-1">
              <p className="text-stone-400 text-xs mb-2">Останні зміни</p>
              <div className="space-y-2 max-h-44 overflow-auto no-scrollbar">
                {shiftHistory.length === 0 && (
                  <div className="text-xs text-stone-500">Історія змін порожня.</div>
                )}
                {shiftHistory.slice(0, 5).map((shift) => (
                  <div key={shift.id} className="bg-stone-700 rounded-xl p-2.5">
                    <div className="text-white text-sm font-semibold">#{shift.id} • {shift.location?.name || 'Локація'}</div>
                    <div className="text-xs text-stone-400 mt-1">
                      {new Date(shift.startedAt).toLocaleString('uk-UA')} → {shift.endedAt ? new Date(shift.endedAt).toLocaleString('uk-UA') : 'активна'}
                    </div>
                    <div className="text-xs text-amber-400 mt-1">
                      Замовлень: {shift.ordersCount} • Чайові: {Math.round(Number(shift.totalTips || 0))} ₴
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Підказки */}
        {!foundUser && (
          <div className="bg-stone-800/50 rounded-2xl p-4 space-y-2">
            <p className="text-stone-400 text-xs font-medium uppercase tracking-wide">Як це працює</p>
            <div className="space-y-2 text-stone-400 text-sm">
              <p>1️⃣ Клієнт каже свій номер телефону</p>
              <p>2️⃣ Ввів → натиснув →</p>
              <p>3️⃣ Вибрав або ввів суму чеку</p>
              <p>4️⃣ ✅ Нарахував — клієнт отримає сповіщення в Telegram</p>
            </div>
            <div className="mt-3 pt-3 border-t border-stone-700 text-xs text-stone-500">
              Якщо клієнт ще не в системі — попроси відсканувати QR або відкрити @perkup_bot
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-xl font-bold text-sm whitespace-nowrap z-50 ${
          toast.ok ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.ok ? '✅' : '❌'} {toast.text}
        </div>
      )}
    </div>
  )
}
