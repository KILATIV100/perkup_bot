import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { gameApi } from '../lib/api'

const LEVEL_EMOJI: Record<string, string> = {
  Bronze: '🥉', Silver: '🥈', Gold: '🥇', Platinum: '💎',
}
const RANK_BADGE = ['🏆','🥈','🥉']

type Tab = 'points' | 'games'

export default function LeaderboardPage() {
  const [tab, setTab] = useState<Tab>('points')

  const { data: pointsData, isLoading: loadingPoints } = useQuery({
    queryKey: ['leaderboard-points'],
    queryFn: () => gameApi.getLeaderboardPoints().then(r => r.data),
    staleTime: 60_000,
  })

  const { data: gamesData, isLoading: loadingGames } = useQuery({
    queryKey: ['leaderboard-games'],
    queryFn: () => gameApi.getLeaderboardGames().then(r => r.data),
    staleTime: 60_000,
  })

  const list = tab === 'points' ? pointsData?.leaderboard : gamesData?.leaderboard
  const isLoading = tab === 'points' ? loadingPoints : loadingGames

  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-28">

      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-900 via-amber-800 to-stone-800 px-5 pt-6 pb-8">
        <h1 className="text-white text-xl font-bold tracking-tight">🏆 Рейтинг</h1>
        <p className="text-amber-200 text-sm mt-0.5">Хто заробив найбільше в PerkUp</p>
      </div>

      {/* Tabs */}
      <div className="mx-4 -mt-4 bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="flex">
          {([['points','⭐ По балах'],['games','🎮 По іграх']] as [Tab,string][]).map(([t,label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                tab === t
                  ? 'bg-amber-800 text-white'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 mt-4 space-y-2">
        {isLoading && (
          Array.from({length: 8}).map((_, i) => (
            <div key={i} className="h-16 bg-white rounded-2xl animate-pulse border border-stone-100" />
          ))
        )}

        {!isLoading && list?.map((entry: any) => {
          const isTop3 = entry.rank <= 3
          return (
            <div
              key={entry.rank}
              className={`flex items-center gap-4 px-4 py-3 rounded-2xl border transition-all ${
                isTop3
                  ? 'bg-white border-amber-200 shadow-sm'
                  : 'bg-white border-stone-100'
              }`}
            >
              {/* Rank */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-lg ${
                entry.rank === 1 ? 'bg-amber-100 text-amber-800' :
                entry.rank === 2 ? 'bg-stone-100 text-stone-600' :
                entry.rank === 3 ? 'bg-orange-50 text-orange-700' :
                'bg-stone-50 text-stone-400 text-sm'
              }`}>
                {isTop3 ? RANK_BADGE[entry.rank - 1] : entry.rank}
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-stone-800 truncate">{entry.name}</span>
                  {entry.level && (
                    <span className="text-sm shrink-0">{LEVEL_EMOJI[entry.level] || ''}</span>
                  )}
                </div>
                <p className="text-xs text-stone-400 mt-0.5">
                  {entry.level || ''}
                </p>
              </div>

              {/* Score */}
              <div className="text-right shrink-0">
                {tab === 'points' ? (
                  <span className="font-bold text-amber-800 text-lg">{entry.points?.toLocaleString()}</span>
                ) : (
                  <span className="font-bold text-amber-800 text-lg">{entry.gamesPlayed}</span>
                )}
                <p className="text-xs text-stone-400">{tab === 'points' ? 'балів' : 'ігор'}</p>
              </div>
            </div>
          )
        })}

        {!isLoading && (!list || list.length === 0) && (
          <div className="text-center py-12 text-stone-400">
            <div className="text-4xl mb-3">🏆</div>
            <p className="font-medium">Рейтинг порожній</p>
            <p className="text-sm mt-1">Будь першим!</p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="mx-4 mt-4 bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-800 space-y-1">
        <p className="font-medium">Як потрапити в рейтинг?</p>
        <p>⭐ По балах — замовляй каву та граєш ігри</p>
        <p>🎮 По іграх — грай щодня в Fun Zone</p>
        <p className="text-stone-400 mt-1">Оновлюється в реальному часі</p>
      </div>
    </div>
  )
}
