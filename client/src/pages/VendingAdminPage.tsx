import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'

/* ─── Types ─────────────────────────────────────────────── */
interface Drink {
  id: string
  name: string
  machineCode: string
  machineLabel: string
  price: number
  isPopular: boolean
  isActive: boolean
}

type SyncStatus = 'live' | 'draft' | 'publishing'

/* ─── Initial data ──────────────────────────────────────── */
const INITIAL_DRINKS: Drink[] = [
  { id: '1', name: 'Капучино', machineCode: '03', machineLabel: 'Cappuccino', price: 55, isPopular: true, isActive: true },
  { id: '2', name: 'Лате', machineCode: '05', machineLabel: 'Latte', price: 60, isPopular: false, isActive: true },
  { id: '3', name: 'Американо', machineCode: '01', machineLabel: 'Americano', price: 45, isPopular: true, isActive: true },
  { id: '4', name: 'Еспресо', machineCode: '02', machineLabel: 'Espresso', price: 40, isPopular: false, isActive: true },
  { id: '5', name: 'Какао', machineCode: '07', machineLabel: 'Cocoa', price: 50, isPopular: false, isActive: true },
  { id: '6', name: 'Флет Вайт', machineCode: '04', machineLabel: 'Flat White', price: 65, isPopular: true, isActive: true },
]

let nextId = 100

/* ─── Helpers ───────────────────────────────────────────── */
function findDuplicateCodes(drinks: Drink[]): Set<string> {
  const seen = new Map<string, number>()
  const dupes = new Set<string>()
  for (const d of drinks) {
    if (!d.machineCode) continue
    seen.set(d.machineCode, (seen.get(d.machineCode) || 0) + 1)
  }
  for (const [code, count] of seen) {
    if (count > 1) dupes.add(code)
  }
  return dupes
}

/* ─── Main Page ─────────────────────────────────────────── */
export default function VendingAdminPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [drinks, setDrinks] = useState<Drink[]>(INITIAL_DRINKS)
  const [status, setStatus] = useState<SyncStatus>('live')
  const [showPreview, setShowPreview] = useState(false)
  const [toast, setToast] = useState('')

  if (!user || !['ADMIN', 'OWNER'].includes(user.role)) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-600 font-semibold">⛔ Доступ заборонено</p>
        <button onClick={() => navigate('/admin')} className="mt-3 px-4 py-2 rounded-xl bg-coffee-600 text-white text-sm">Назад</button>
      </div>
    )
  }

  const duplicateCodes = findDuplicateCodes(drinks)
  const hasErrors = duplicateCodes.size > 0
  const activeDrinks = drinks.filter(d => d.isActive)
  const popularDrinks = activeDrinks.filter(d => d.isPopular)

  const markDraft = () => { if (status === 'live') setStatus('draft') }

  const updateDrink = (id: string, field: keyof Drink, value: any) => {
    setDrinks(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d))
    markDraft()
  }

  const addDrink = () => {
    const newId = String(++nextId)
    setDrinks(prev => [...prev, {
      id: newId, name: '', machineCode: '', machineLabel: '', price: 0, isPopular: false, isActive: true,
    }])
    markDraft()
  }

  const deleteDrink = (id: string) => {
    setDrinks(prev => prev.filter(d => d.id !== id))
    markDraft()
  }

  const duplicateDrink = (id: string) => {
    const src = drinks.find(d => d.id === id)
    if (!src) return
    const newId = String(++nextId)
    setDrinks(prev => [...prev, { ...src, id: newId, machineCode: '', name: src.name + ' (копія)' }])
    markDraft()
  }

  const publish = async () => {
    if (hasErrors) {
      showToast('❌ Виправте помилки перед публікацією')
      return
    }
    setStatus('publishing')
    // TODO: POST to API
    await new Promise(r => setTimeout(r, 1200))
    setStatus('live')
    showToast('✅ Меню опубліковано!')
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <div className="min-h-screen bg-[#f8f5f0]">
      {/* ─── Header ─── */}
      <div className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin')}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 active:scale-95 transition-transform text-gray-600">
            ←
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-800 truncate">Mark Mall • Автомат</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={status} />
              <span className="text-xs text-gray-400">{activeDrinks.length} напоїв · {popularDrinks.length} популярних</span>
            </div>
          </div>
          <button onClick={() => setShowPreview(!showPreview)}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${showPreview ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
            📱
          </button>
          <button onClick={publish}
            disabled={status === 'publishing' || status === 'live'}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              status === 'draft'
                ? 'bg-green-600 text-white active:scale-95 shadow-lg shadow-green-200'
                : status === 'publishing'
                  ? 'bg-yellow-500 text-white animate-pulse'
                  : 'bg-gray-100 text-gray-400'
            }`}>
            {status === 'publishing' ? '⏳' : status === 'draft' ? '🚀 Опублікувати' : '✓ Live'}
          </button>
        </div>
      </div>

      {/* ─── Errors banner ─── */}
      {hasErrors && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          ⚠️ Коди мають бути унікальними! Дублікати: {Array.from(duplicateCodes).join(', ')}
        </div>
      )}

      {/* ─── Main content ─── */}
      <div className={`p-4 pb-32 ${showPreview ? 'lg:flex lg:gap-6' : ''}`}>

        {/* ─── Editor ─── */}
        <div className="flex-1 space-y-3">
          {/* Quick Picks section */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-700">🔥 Quick Picks</h2>
              <span className="text-xs text-gray-400">{popularDrinks.length} шт</span>
            </div>
            {popularDrinks.length === 0 ? (
              <p className="text-sm text-gray-400">Позначте напої як популярні (🔥) щоб вони з'явились тут</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {popularDrinks.map(d => (
                  <span key={d.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-sm text-amber-800">
                    <span className="font-mono text-xs bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">{d.machineCode || '??'}</span>
                    {d.name || '—'}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Drinks table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-700">☕ Напої ({drinks.length})</h2>
              <button onClick={addDrink}
                className="px-3 py-1.5 rounded-xl bg-coffee-600 text-white text-xs font-semibold active:scale-95 transition-transform">
                + Додати
              </button>
            </div>

            {/* Table header — desktop */}
            <div className="hidden md:grid grid-cols-[1fr_80px_1fr_90px_50px_50px_90px] gap-2 px-4 py-2 bg-gray-50 text-xs text-gray-500 font-medium">
              <span>Назва</span>
              <span>Код</span>
              <span>Label</span>
              <span>Ціна ₴</span>
              <span className="text-center">🔥</span>
              <span className="text-center">👁</span>
              <span className="text-center">Дії</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gray-50">
              {drinks.map(drink => (
                <DrinkRow
                  key={drink.id}
                  drink={drink}
                  isDuplicate={duplicateCodes.has(drink.machineCode)}
                  onUpdate={updateDrink}
                  onDelete={deleteDrink}
                  onDuplicate={duplicateDrink}
                />
              ))}
            </div>

            {drinks.length === 0 && (
              <div className="py-12 text-center text-gray-400 text-sm">
                Додайте перший напій щоб почати
              </div>
            )}
          </div>
        </div>

        {/* ─── Phone Preview ─── */}
        {showPreview && (
          <div className="mt-6 lg:mt-0 lg:w-[340px] lg:flex-shrink-0">
            <div className="sticky top-24">
              <PhonePreview drinks={activeDrinks} popularDrinks={popularDrinks} />
            </div>
          </div>
        )}
      </div>

      {/* ─── Toast ─── */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-gray-900 text-white text-sm font-medium shadow-2xl animate-[fadeIn_0.2s_ease-out]">
          {toast}
        </div>
      )}
    </div>
  )
}

/* ─── Status Badge ──────────────────────────────────────── */
function StatusBadge({ status }: { status: SyncStatus }) {
  const styles = {
    live: 'bg-green-100 text-green-700',
    draft: 'bg-amber-100 text-amber-700',
    publishing: 'bg-yellow-100 text-yellow-700 animate-pulse',
  }
  const labels = { live: '● Live', draft: '○ Draft', publishing: '⏳ Публікація...' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

/* ─── Drink Row ─────────────────────────────────────────── */
function DrinkRow({ drink, isDuplicate, onUpdate, onDelete, onDuplicate }: {
  drink: Drink
  isDuplicate: boolean
  onUpdate: (id: string, field: keyof Drink, value: any) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
}) {
  const [showActions, setShowActions] = useState(false)

  const rowBg = isDuplicate
    ? 'bg-red-50 border-l-4 border-l-red-400'
    : !drink.isActive
      ? 'bg-gray-50 opacity-60'
      : ''

  return (
    <div className={`px-4 py-3 ${rowBg} transition-colors`}>
      {/* Mobile layout */}
      <div className="md:hidden space-y-2">
        <div className="flex items-center gap-2">
          <span className={`w-10 h-10 flex items-center justify-center rounded-lg font-mono font-bold text-sm ${
            isDuplicate ? 'bg-red-200 text-red-800' : 'bg-blue-100 text-blue-700'
          }`}>
            {drink.machineCode || '??'}
          </span>
          <div className="flex-1 min-w-0">
            <input
              value={drink.name}
              onChange={e => onUpdate(drink.id, 'name', e.target.value)}
              placeholder="Назва напою"
              className="w-full text-sm font-semibold text-gray-800 bg-transparent border-b border-transparent focus:border-coffee-400 outline-none py-0.5"
            />
            <input
              value={drink.machineLabel}
              onChange={e => onUpdate(drink.id, 'machineLabel', e.target.value)}
              placeholder="Label на автоматі"
              className="w-full text-xs text-gray-500 bg-transparent border-b border-transparent focus:border-coffee-400 outline-none py-0.5"
            />
          </div>
          <button onClick={() => setShowActions(!showActions)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 active:bg-gray-100">
            ⋯
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">Код:</span>
            <input
              value={drink.machineCode}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 2)
                onUpdate(drink.id, 'machineCode', val)
              }}
              placeholder="00"
              maxLength={2}
              className={`w-10 text-center text-sm font-mono font-bold rounded-lg py-1 border ${
                isDuplicate ? 'border-red-400 bg-red-50 text-red-800' : 'border-gray-200 bg-white text-gray-800'
              } outline-none focus:ring-2 focus:ring-blue-300`}
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400">₴</span>
            <input
              type="number"
              value={drink.price || ''}
              onChange={e => onUpdate(drink.id, 'price', Number(e.target.value))}
              placeholder="0"
              className="w-16 text-sm text-center font-semibold rounded-lg py-1 border border-gray-200 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          <button onClick={() => onUpdate(drink.id, 'isPopular', !drink.isPopular)}
            className={`px-2.5 py-1 rounded-lg text-sm transition-all ${
              drink.isPopular ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'
            }`}>
            🔥
          </button>

          <button onClick={() => onUpdate(drink.id, 'isActive', !drink.isActive)}
            className={`px-2.5 py-1 rounded-lg text-sm transition-all ${
              drink.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
            }`}>
            {drink.isActive ? '👁' : '🚫'}
          </button>
        </div>

        {showActions && (
          <div className="flex gap-2 pt-1">
            <button onClick={() => onDuplicate(drink.id)}
              className="flex-1 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium">
              📋 Копіювати
            </button>
            <button onClick={() => onDelete(drink.id)}
              className="flex-1 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium">
              🗑 Видалити
            </button>
          </div>
        )}
      </div>

      {/* Desktop layout */}
      <div className="hidden md:grid grid-cols-[1fr_80px_1fr_90px_50px_50px_90px] gap-2 items-center">
        <input
          value={drink.name}
          onChange={e => onUpdate(drink.id, 'name', e.target.value)}
          placeholder="Назва"
          className="text-sm font-medium text-gray-800 bg-transparent border border-transparent rounded-lg px-2 py-1.5 focus:border-coffee-300 focus:bg-white outline-none"
        />
        <input
          value={drink.machineCode}
          onChange={e => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 2)
            onUpdate(drink.id, 'machineCode', val)
          }}
          placeholder="00"
          maxLength={2}
          className={`text-center text-sm font-mono font-bold rounded-lg px-2 py-1.5 border ${
            isDuplicate ? 'border-red-400 bg-red-50 text-red-800' : 'border-gray-200 bg-white text-gray-800'
          } outline-none focus:ring-2 focus:ring-blue-300`}
        />
        <input
          value={drink.machineLabel}
          onChange={e => onUpdate(drink.id, 'machineLabel', e.target.value)}
          placeholder="Label"
          className="text-sm text-gray-600 bg-transparent border border-transparent rounded-lg px-2 py-1.5 focus:border-coffee-300 focus:bg-white outline-none"
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={drink.price || ''}
            onChange={e => onUpdate(drink.id, 'price', Number(e.target.value))}
            className="w-full text-sm text-center font-semibold rounded-lg px-2 py-1.5 border border-gray-200 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-blue-300"
          />
          <span className="text-xs text-gray-400">₴</span>
        </div>
        <button onClick={() => onUpdate(drink.id, 'isPopular', !drink.isPopular)}
          className={`w-full py-1.5 rounded-lg text-center text-sm transition-all ${
            drink.isPopular ? 'bg-amber-100' : 'bg-gray-50 opacity-40'
          }`}>
          🔥
        </button>
        <button onClick={() => onUpdate(drink.id, 'isActive', !drink.isActive)}
          className={`w-full py-1.5 rounded-lg text-center text-sm transition-all ${
            drink.isActive ? 'bg-green-50' : 'bg-red-50'
          }`}>
          {drink.isActive ? '👁' : '🚫'}
        </button>
        <div className="flex gap-1 justify-center">
          <button onClick={() => onDuplicate(drink.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors" title="Копіювати">📋</button>
          <button onClick={() => onDelete(drink.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Видалити">🗑</button>
        </div>
      </div>
    </div>
  )
}

/* ─── Phone Preview ─────────────────────────────────────── */
function PhonePreview({ drinks, popularDrinks }: { drinks: Drink[]; popularDrinks: Drink[] }) {
  const sortedDrinks = [...drinks].sort((a, b) => {
    const codeA = parseInt(a.machineCode || '99')
    const codeB = parseInt(b.machineCode || '99')
    return codeA - codeB
  })

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-gray-400 mb-2 font-medium">📱 Прев'ю клієнта</span>
      <div className="w-[300px] border-[6px] border-gray-800 rounded-[36px] overflow-hidden shadow-2xl bg-white">
        {/* Notch */}
        <div className="h-7 bg-gray-800 flex items-end justify-center pb-1">
          <div className="w-20 h-1.5 bg-gray-700 rounded-full" />
        </div>

        {/* Screen */}
        <div className="h-[520px] overflow-y-auto bg-[#fdf6ed]">
          {/* App header */}
          <div className="px-4 pt-4 pb-3">
            <div className="text-xs text-gray-400">📍 Mark Mall</div>
            <div className="text-lg font-bold text-gray-800 mt-0.5">Автомат PerkUP</div>
          </div>

          {/* Quick Picks */}
          {popularDrinks.length > 0 && (
            <div className="px-4 pb-3">
              <div className="text-xs font-semibold text-gray-500 mb-2">⚡ Швидкий вибір</div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {popularDrinks.map(d => (
                  <button key={d.id}
                    className="flex-shrink-0 px-3 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 shadow-sm flex items-center gap-1.5">
                    <span className="text-[10px] font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">{d.machineCode || '??'}</span>
                    <span className="whitespace-nowrap">{d.name || '—'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Separator */}
          <div className="h-px bg-gray-200 mx-4" />

          {/* Drinks list */}
          <div className="px-4 pt-3 pb-6 space-y-2">
            <div className="text-xs font-semibold text-gray-500 mb-1">☕ Усі напої</div>
            {sortedDrinks.map(d => (
              <div key={d.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className={`w-11 h-11 flex items-center justify-center rounded-xl font-mono font-bold text-sm ${
                  d.isPopular ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'
                }`}>
                  {d.machineCode || '??'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">
                    {d.name || '—'}
                    {d.isPopular && <span className="ml-1 text-xs">🔥</span>}
                  </div>
                  <div className="text-xs text-gray-400">{d.machineLabel || '—'}</div>
                </div>
                <div className="text-sm font-bold text-gray-800">{d.price || 0} ₴</div>
              </div>
            ))}
            {sortedDrinks.length === 0 && (
              <div className="text-center text-gray-400 text-sm py-8">Немає напоїв</div>
            )}
          </div>
        </div>

        {/* Home bar */}
        <div className="h-5 bg-white flex items-center justify-center">
          <div className="w-24 h-1 bg-gray-300 rounded-full" />
        </div>
      </div>
    </div>
  )
}
