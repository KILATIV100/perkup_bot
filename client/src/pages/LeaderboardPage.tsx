import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { gameApi } from '../lib/api'

type TabType = 'games' | 'orders_week' | 'orders_all'

const TABS: { id: TabType; icon: string; label: string; sublabel: string }[] = [
  { id: 'games',       icon: '🎮', label: 'Ігри',       sublabel: 'кількість партій' },
  { id: 'orders_week', icon: '📅', label: 'Тиждень',    sublabel: 'замовлень за 7 днів' },
  { id: 'orders_all',  icon: '👑', label: 'Всі часи',   sublabel: 'замовлень загалом' },
]

const LEVEL_COLOR: Record<string, string> = {
  Bronze:   'text-amber-700 bg-amber-100',
  Silver:   'text-slate-600 bg-slate-100',
  Gold:     'text-yellow-700 bg-yellow-100',
  Platinum: 'text-violet-700 bg-violet-100',
}

interface Entry {
  rank: number
  name: string
  level: string
  value: number
  label: string
}

function Podium({ top3, tab }: { top3: Entry[]; tab: TabType }) {
  const order = [top3[1], top3[0], top3[2]].filter(Boolean) // 2nd, 1st, 3rd

  const heights = tab === 'games'
    ? ['h-20', 'h-28', 'h-14']
    : ['h-20', 'h-28', 'h-14']

  const medals = ['🥈','🥇','🥉']
  const bgColors = ['bg-slate-200','bg-amber-300','bg-orange-200']
  const textColors = ['text-slate-600','text-amber-900','text-orange-800']

  return (
    <div className="flex items-end justify-center gap-2 px-4 pt-4 pb-2">
      {order.map((entry, i) => {
        if (!entry) return <div key={i} className="w-24" />
        const isFirst = i === 1
        return (
          <div key={entry.rank} className="flex flex-col items-center gap-1 w-24">
            {/* Avatar */}
            <div className={`relative ${isFirst ? 'w-16 h-16' : 'w-12 h-12'} rounded-full ${bgColors[i]} flex items-center justify-center ${textColors[i]} font-black ${isFirst ? 'text-2xl shadow-lg ring-4 ring-amber-400' : 'text-lg'}`}>
              {entry.name.charAt(0).toUpperCase()}
              <span className="absolute -top-2 -right-1 text-base">{medals[i]}</span>
            </div>
            {/* Name */}
            <p className={`text-xs font-semibold text-center leading-tight text-stone-700 ${isFirst ? '' : 'opacity-80'}`}>
              {entry.name.split(' ')[0]}
            </p>
            {/* Score block */}
            <div className={`${heights[i]} ${bgColors[i]} w-full rounded-t-xl flex flex-col items-center justify-center`}>
              <span className={`font-black ${isFirst ? 'text-xl' : 'text-base'} ${textColors[i]}`}>{entry.value}</span>
              <span className={`text-[9px] ${textColors[i]} opacity-70`}>{entry.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<TabType>('games')
  const [animKey, setAnimKey] = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', tab],
    queryFn: () => gameApi.getLeaderboard(tab).then((r: any) => r.data),
    staleTime: 30_000,
  })

  useEffect(() => { setAnimKey(k => k + 1) }, [tab])

  const list: Entry[] = data?.leaderboard || []
  const top3 = list.slice(0, 3)
  const rest = list.slice(3)

  const currentTab = TABS.find(t => t.id === tab)!

  return (
    <div className="min-h-screen pb-28" style={{ background: 'linear-gradient(180deg, #1c0a02 0%, #2d1408 35%, #faf7f4 35%)' }}>

      {/* Header */}
      <div className="px-5 pt-6 pb-2">
        <h1 className="text-white text-2xl font-black tracking-tight">🏆 Рейтинг</h1>
        <p className="text-amber-300/70 text-sm mt-0.5">Хто перший у PerkUp?</p>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-3">
        <div className="flex bg-white/10 backdrop-blur rounded-2xl p-1 gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center py-2 rounded-xl transition-all duration-200 ${
                tab === t.id
                  ? 'bg-amber-400 text-amber-900 shadow-md'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <span className="text-base">{t.icon}</span>
              <span className="text-[10px] font-bold mt-0.5">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Podium */}
      {!isLoading && top3.length >= 2 && (
        <div key={`podium-${animKey}`} className="mt-2">
          <Podium top3={top3} tab={tab} />
        </div>
      )}

      {/* White card section */}
      <div className="mx-3 mt-3 bg-white rounded-3xl shadow-xl overflow-hidden">

        {/* Section title */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <p className="font-bold text-stone-800 text-sm">Повний рейтинг</p>
            <p className="text-stone-400 text-xs mt-0.5">{currentTab.icon} {currentTab.sublabel}</p>
          </div>
          {!isLoading && <span className="text-xs text-stone-400 bg-stone-50 px-2 py-1 rounded-lg">{list.length} учасників</span>}
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="p-4 space-y-3">
            {Array.from({length: 6}).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 bg-stone-100 rounded-xl" />
                <div className="w-9 h-9 bg-stone-100 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-stone-100 rounded-full w-2/3" />
                  <div className="h-2 bg-stone-50 rounded-full w-1/3" />
                </div>
                <div className="w-10 h-8 bg-stone-100 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* List — top3 shown in full, rest below */}
        {!isLoading && (
          <div key={`list-${animKey}`}>
            {list.map((entry, idx) => {
              const isTop3 = entry.rank <= 3
              const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : null
              const levelCls = LEVEL_COLOR[entry.level] || 'text-stone-500 bg-stone-100'

              return (
                <div
                  key={entry.rank}
                  className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                    isTop3 ? 'bg-amber-50/50' : idx % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'
                  } ${idx < list.length - 1 ? 'border-b border-stone-100/70' : ''}`}
                  style={{ animationDelay: `${idx * 30}ms` }}
                >
                  {/* Rank */}
                  <div className={`w-8 text-center font-black shrink-0 ${
                    entry.rank === 1 ? 'text-amber-500 text-lg' :
                    entry.rank === 2 ? 'text-slate-500 text-base' :
                    entry.rank === 3 ? 'text-orange-500 text-base' :
                    'text-stone-400 text-sm'
                  }`}>
                    {medal || entry.rank}
                  </div>

                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    isTop3 ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600'
                  }`}>
                    {entry.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name + level */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${isTop3 ? 'text-stone-800' : 'text-stone-700'}`}>
                      {entry.name}
                    </p>
                    {entry.level && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${levelCls}`}>
                        {entry.level}
                      </span>
                    )}
                  </div>

                  {/* Score */}
                  <div className={`text-right shrink-0 ${isTop3 ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600'} px-3 py-1.5 rounded-xl`}>
                    <p className={`font-black leading-none ${isTop3 ? 'text-base' : 'text-sm'}`}>{entry.value}</p>
                    <p className="text-[9px] opacity-60 mt-0.5">{entry.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Empty */}
        {!isLoading && list.length === 0 && (
          <div className="py-16 text-center">
            <div className="text-5xl mb-3">🏆</div>
            <p className="font-semibold text-stone-500">Ще немає даних</p>
            <p className="text-stone-400 text-sm mt-1">Будь першим!</p>
          </div>
        )}

        {/* Footer hint */}
        {!isLoading && list.length > 0 && (
          <div className="px-5 py-4 bg-stone-50 border-t border-stone-100">
            <p className="text-xs text-stone-400 text-center">
              {tab === 'games' && '🎮 Грай щодня щоб підніматись в рейтингу'}
              {tab === 'orders_week' && '📅 Рейтинг оновлюється щотижня в понеділок'}
              {tab === 'orders_all' && '👑 Загальний рейтинг постійних клієнтів PerkUp'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
