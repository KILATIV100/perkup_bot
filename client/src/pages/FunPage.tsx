import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import CoffeeJumpGame from '../components/CoffeeJumpGame'
import { gameApi } from '../lib/api'

interface LeaderEntry {
  rank: number
  userId: number
  name: string
  score: number
}

interface MyStats {
  bestScore: number
  rank: number | null
  playsToday: number
  playsLimit: number
  rewards: { score: number; points: number; claimed: boolean }[]
}

interface GameStatus {
  date: string
  playsToday: number
  playsLimit: number
  pointsEarnedToday: number
  pointsCapToday: number
}

type Tab = 'game' | 'leaderboard' | 'rewards'
type MiniGameType = 'TIC_TAC_TOE' | 'PERKIE_CATCH' | 'BARISTA_RUSH' | 'MEMORY_COFFEE' | 'PERKIE_JUMP'

const MINI_GAMES: Array<{ type: MiniGameType; label: string; score: number }> = [
  { type: 'TIC_TAC_TOE', label: 'Tic Tac Toe', score: 10 },
  { type: 'PERKIE_CATCH', label: 'Runner', score: 12 },
  { type: 'BARISTA_RUSH', label: 'Barista Rush', score: 14 },
  { type: 'MEMORY_COFFEE', label: 'Memory', score: 8 },
  { type: 'PERKIE_JUMP', label: 'Word Puzzle', score: 6 },
]

export default function FunPage() {
  const [tab, setTab] = useState<Tab>('game')
  const [lastScore, setLastScore] = useState<number | null>(null)
  const [lastResult, setLastResult] = useState<{
    isNewRecord: boolean; bestScore: number; rank: number | null; earnedPoints: number
  } | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([])
  const [lbLoading, setLbLoading] = useState(false)
  const [stats, setStats] = useState<MyStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [finishingType, setFinishingType] = useState<string | null>(null)

  const handleGameOver = useCallback(async (score: number) => {
    setLastScore(score)
    try {
      const res = await gameApi.submitScore(score)
      setLastResult(res.data)
    } catch {
      setLastResult(null)
    }
  }, [])

  const loadLeaderboard = useCallback(async () => {
    setLbLoading(true)
    try {
      const res = await gameApi.getLeaderboard()
      setLeaderboard(res.data.leaderboard || [])
    } catch {
      setLeaderboard([])
    } finally {
      setLbLoading(false)
    }
  }, [])

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await gameApi.getMyStats()
      setStats(res.data)
    } catch {
      setStats(null)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const loadGameStatus = useCallback(async () => {
    setStatusLoading(true)
    try {
      const res = await gameApi.getStatus()
      setGameStatus(res.data)
    } catch {
      setGameStatus(null)
    } finally {
      setStatusLoading(false)
    }
  }, [])

  const finishMiniGame = useCallback(async (type: MiniGameType, score: number) => {
    setFinishingType(type)
    try {
      await gameApi.finish({ type, score })
      await loadGameStatus()
      await loadStats()
    } finally {
      setFinishingType(null)
    }
  }, [loadGameStatus, loadStats])

  useEffect(() => {
    if (tab === 'leaderboard') loadLeaderboard()
    if (tab === 'rewards') loadStats()
    if (tab === 'game') loadGameStatus()
  }, [tab, loadLeaderboard, loadStats, loadGameStatus])

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3">
        <Link to="/community" className="block bg-gradient-to-r from-coffee-50 to-amber-50 border border-coffee-200 rounded-xl p-3">
          <div className="font-bold text-coffee-800">Клуб PerkUp</div>
          <div className="text-xs text-gray-600">Настільні ігри, кіновечори та люди поруч.</div>
        </Link>
      </div>

      <div className="flex border-b border-gray-100 bg-white sticky top-0 z-10 mt-2">
        {([
          { key: 'game' as Tab, label: '🎮 Гра' },
          { key: 'leaderboard' as Tab, label: '🏆 Топ' },
          { key: 'rewards' as Tab, label: '🎁 Нагороди' },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              tab === t.key ? 'text-coffee-600 border-b-2 border-coffee-500' : 'text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'game' && (
        <div className="flex-1 flex flex-col p-3 pb-24 gap-3">
          {lastResult && lastScore !== null && (
            <div className={`p-3 rounded-xl text-center text-sm ${
              lastResult.isNewRecord
                ? 'bg-gradient-to-r from-amber-100 to-yellow-100 border border-amber-200'
                : 'bg-gray-50 border border-gray-100'
            }`}>
              {lastResult.isNewRecord && (
                <div className="text-amber-600 font-bold text-base mb-1">Новий рекорд 🎉</div>
              )}
              <div className="flex justify-center gap-4 text-gray-700">
                <span>Результат: <b>{lastScore}</b></span>
                <span>Рекорд: <b>{lastResult.bestScore}</b></span>
                {lastResult.rank && <span>Місце: <b>#{lastResult.rank}</b></span>}
              </div>
              {lastResult.earnedPoints > 0 && (
                <div className="mt-1 text-coffee-600 font-bold">+{lastResult.earnedPoints} бонусних балів ☕</div>
              )}
            </div>
          )}

          <CoffeeJumpGame onGameOver={handleGameOver} />

          <div className="bg-white border border-gray-100 rounded-xl p-3">
            <div className="font-bold text-gray-700 text-sm mb-2">Mini games progress</div>
            {statusLoading ? (
              <div className="text-xs text-gray-400">Loading...</div>
            ) : gameStatus ? (
              <div className="text-xs text-gray-500 mb-2">
                Plays today: <b>{gameStatus.playsToday}/{gameStatus.playsLimit}</b> · Points: <b>{gameStatus.pointsEarnedToday}/{gameStatus.pointsCapToday}</b>
              </div>
            ) : (
              <div className="text-xs text-gray-400 mb-2">Status unavailable</div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {MINI_GAMES.map((game) => (
                <button
                  key={game.type}
                  onClick={() => finishMiniGame(game.type, game.score)}
                  disabled={!!finishingType}
                  className="px-2 py-2 rounded-lg bg-coffee-50 border border-coffee-200 text-xs font-medium text-coffee-700 disabled:opacity-50"
                >
                  {finishingType === game.type ? 'Saving...' : game.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className="flex-1 p-4 pb-24">
          <h2 className="text-lg font-bold text-coffee-800 mb-3">🏆 Лідерборд</h2>
          {lbLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-12 rounded-xl" />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <span className="text-4xl block mb-2">🎮</span>
              Поки що немає результатів
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    entry.rank <= 3
                      ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'
                      : 'bg-white border-gray-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    entry.rank === 1 ? 'bg-amber-400 text-white' :
                      entry.rank === 2 ? 'bg-gray-300 text-white' :
                        entry.rank === 3 ? 'bg-amber-600 text-white' :
                          'bg-gray-100 text-gray-500'
                  }`}>
                    {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-gray-800">{entry.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-coffee-600">☕ {entry.score.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'rewards' && (
        <div className="flex-1 p-4 pb-24">
          <h2 className="text-lg font-bold text-coffee-800 mb-3">🎁 Нагороди гри</h2>

          {statsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-white p-3 rounded-xl border border-gray-100 text-center">
                  <div className="text-lg font-bold text-coffee-600">☕ {stats.bestScore}</div>
                  <div className="text-[10px] text-gray-400">Рекорд</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100 text-center">
                  <div className="text-lg font-bold text-coffee-600">{stats.rank ? `#${stats.rank}` : '—'}</div>
                  <div className="text-[10px] text-gray-400">Місце</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100 text-center">
                  <div className="text-lg font-bold text-coffee-600">{stats.playsToday}/{stats.playsLimit}</div>
                  <div className="text-[10px] text-gray-400">Ігор сьогодні</div>
                </div>
              </div>

              <h3 className="font-bold text-gray-700 mb-2 text-sm">Пороги нагород</h3>
              <div className="space-y-2">
                {stats.rewards.map((r) => {
                  const reached = stats.bestScore >= r.score
                  return (
                    <div
                      key={r.score}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        r.claimed
                          ? 'bg-green-50 border-green-200'
                          : reached
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <div className={`text-2xl ${r.claimed ? '' : reached ? 'grayscale-0' : 'grayscale opacity-40'}`}>
                        {r.claimed ? '✅' : reached ? '🎉' : '🔒'}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-sm text-gray-800">Потрібно очок: {r.score.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">+{r.points} бонусних балів</div>
                      </div>
                      <div className={`text-xs font-bold px-2 py-1 rounded-full ${
                        r.claimed ? 'bg-green-100 text-green-700' : reached ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {r.claimed ? 'Claimed' : reached ? 'Achieved' : `${stats.bestScore}/${r.score}`}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400 py-12">
              <span className="text-4xl block mb-2">🎮</span>
              Зіграйте хоча б один раз для статистики
            </div>
          )}
        </div>
      )}
    </div>
  )
}
