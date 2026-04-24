import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { gameApi } from '../lib/api'
import CoffeeJumpGame from '../components/CoffeeJumpGame'
import { gameApi, radioApi } from '../lib/api'
import { useT } from '../lib/i18n'

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

interface RadioTrack {
  id: number
  title: string
  artist: string
  url: string
  duration: number
  genre: string
}

type Tab = 'game' | 'leaderboard' | 'rewards' | 'radio'
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

  // Скрол вгору при відкритті гри
  useEffect(() => {
    if (game !== 'hub') {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [game])

  const loadStatus = useCallback(() => {
    setLoadingStatus(true)
    gameApi.getStatus()
      .then((r: any) => setStatus(r.data))
      .catch(() => {})
      .finally(() => setLoadingStatus(false))
  }, [])

  useEffect(() => { loadStatus() }, [game, loadStatus])

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await gameApi.getMyStats()
      setStats(res.data)
    } catch { setStats(null) }
    finally { setStatsLoading(false) }
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

  // Radio handlers
  const loadRadio = useCallback(async () => {
    setRadioLoading(true)
    try {
      const r = await radioApi.now()
      if (r.data.currentTrack) setRadioTrack(r.data.currentTrack)
    } catch { /* no tracks */ }
    finally { setRadioLoading(false) }
  }, [])

  const syncAudio = useCallback(async () => {
    try {
      const r = await radioApi.now()
      const data = r.data
      if (!data.currentTrack) return
      const audio = audioRef.current
      if (!audio) return
      if (data.currentTrack.id !== radioTrack?.id) {
        setRadioTrack(data.currentTrack)
        audio.src = data.currentTrack.url
        audio.currentTime = data.position
        if (radioPlaying) audio.play().catch(() => {})
      } else {
        const drift = Math.abs(audio.currentTime - data.position)
        if (drift > 3) audio.currentTime = data.position
      }
    } catch { /* ignore */ }
  }, [radioTrack, radioPlaying])

  const handleFinish = useCallback((pts: number) => {
    if (pts > 0) {
      showToast(`+${pts} балів зараховано! ☕`)
    } else {
      showToast('Наступного разу пощастить!')
    }
  }

  useEffect(() => {
    if (tab === 'leaderboard') loadLeaderboard()
    if (tab === 'rewards') { loadStats(); loadGameStatus() }
    if (tab === 'game') loadGameStatus()
    if (tab === 'radio') loadRadio()
  }, [tab, loadLeaderboard, loadStats, loadGameStatus, loadRadio])

  useEffect(() => {
    return () => { if (syncRef.current) clearInterval(syncRef.current) }
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-white sticky top-0 z-10">
        {([
          { key: 'game' as Tab, label: `🎮 ${tFn('fun.tab.game')}` },
          { key: 'radio' as Tab, label: `🎵 ${tFn('fun.tab.radio')}` },
          { key: 'leaderboard' as Tab, label: `🏆 ${tFn('fun.tab.top')}` },
          { key: 'rewards' as Tab, label: `🎁 ${tFn('fun.tab.rewards')}` },
        ]).map(t => (
          <button
            onClick={() => setGame('hub')}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors text-sm"
          >
            ←
          </button>
          <span className="font-semibold text-stone-800">{info.emoji} {info.name}</span>
        </div>

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

        {toast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-medium whitespace-nowrap z-50">
            {toast}
          </div>
        )}
      </div>
    )
  }

  // ── Хаб ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#FAF7F4] pb-28">

      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-900 via-amber-800 to-stone-800 px-5 pt-6 pb-8">
        <h1 className="text-white text-xl font-bold tracking-tight">🎮 Fun Zone</h1>
        <p className="text-amber-200 text-sm mt-0.5">Грай і заробляй бали за замовлення</p>

        {/* Daily progress */}
        <div className="mt-4 bg-white/10 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-amber-100 text-xs font-medium">Денний ліміт балів</span>
            <span className="text-white text-sm font-bold">{dailyUsed} / {dailyMax}</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-300 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {status && (
            <div className="flex justify-between mt-3 text-xs text-amber-200">
              <span>зароблено сьогодні</span>
              <span className="text-white font-semibold">{dailyMax - dailyUsed} залишилось</span>
            </div>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="mx-4 -mt-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
        <span className="text-base shrink-0">💡</span>
        <span>Бали з ігор нараховуються одразу. Ліміт 60 балів на день.</span>
      </div>

      {/* Games list */}
      <div className="px-4 mt-5 space-y-3">
        {GAMES.map(g => {
          const canPlay = !loadingStatus && status?.canPlay[g.id.toUpperCase()] !== false
          const isLoading = loadingStatus

          return (
            <button
              key={g.id}
              onClick={() => setGame(g.id)}
              className="w-full text-left bg-white rounded-2xl border border-stone-100 shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-150 overflow-hidden"
            >
              <div className="flex items-center gap-4 p-4">
                {/* Icon */}
                <div className="w-14 h-14 bg-amber-50 rounded-xl flex items-center justify-center text-3xl shrink-0 border border-amber-100">
                  {g.emoji}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-stone-800 text-sm">{g.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${g.badgeColor}`}>
                      {g.badge}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">{g.desc}</p>
                  <p className="text-xs text-amber-700 font-semibold mt-1">⭐ {g.pts}</p>
                </div>

                {/* Play button */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  isLoading
                    ? 'bg-stone-100 text-stone-300'
                    : canPlay
                    ? 'bg-amber-800 text-white'
                    : 'bg-stone-100 text-stone-300'
                }`}>
                  {isLoading ? '···' : canPlay ? '▶' : '⏸'}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400 py-12">
              <span className="text-4xl block mb-2">🎮</span>
              {tFn('fun.playOnceForStats')}
            </div>
          )}
        </div>
      )}

              {/* Cooldown bar */}
              {!isLoading && !canPlay && (
                <div className="px-4 pb-3">
                  <div className="text-[10px] text-stone-400 flex items-center gap-1">
                    <span>⏱</span>
                    <span>Cooldown активний — спробуй пізніше</span>
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-medium whitespace-nowrap z-50">
          {toast}
        </div>
      )}
    </div>
  )
}
