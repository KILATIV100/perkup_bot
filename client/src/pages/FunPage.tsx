import { useState, useCallback, useEffect } from 'react'
import { gameApi } from '../lib/api'
import CoffeeJumpGame from '../components/CoffeeJumpGame'
import TicTacToe from '../games/TicTacToe'
import MemoryGame from '../games/MemoryGame'
import QuizGame from '../games/QuizGame'
import WordPuzzle from '../games/WordPuzzle'

type GameId = 'hub' | 'runner' | 'tictactoe' | 'memory' | 'quiz' | 'word'

interface GameStatus {
  daily: { current: number; max: number }
  pending: number
  bonus: number
  canPlay: Record<string, boolean>
}

const GAMES: { id: GameId; emoji: string; name: string; desc: string; pts: string; badge: string; badgeColor: string }[] = [
  { id: 'runner',    emoji: '🏃', name: 'PerkUp Runner',    desc: 'Стрибай, збирай зерна',   pts: 'до 10 балів',  badge: 'Соло',    badgeColor: 'bg-sky-100 text-sky-700' },
  { id: 'tictactoe', emoji: '❌', name: 'Хрестики-нулики',  desc: 'Vs AI · Cooldown 4 год',  pts: 'Перемога 5б',  badge: '1v1',     badgeColor: 'bg-green-100 text-green-700' },
  { id: 'memory',    emoji: '🃏', name: "Кавова пам'ять",   desc: 'Знайди всі пари',         pts: 'до 5 балів',   badge: 'Соло',    badgeColor: 'bg-sky-100 text-sky-700' },
  { id: 'quiz',      emoji: '🎯', name: 'Кавовий квіз',     desc: '1 питання на добу',       pts: '3 бали',       badge: '1×/день', badgeColor: 'bg-violet-100 text-violet-700' },
  { id: 'word',      emoji: '🧩', name: 'Ворд-пазл',        desc: 'Знайди кавові слова',     pts: '1б/слово',     badge: 'Соло',    badgeColor: 'bg-sky-100 text-sky-700' },
]

export default function FunPage() {
  const [game, setGame] = useState<GameId>('hub')
  const [status, setStatus] = useState<GameStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [toast, setToast] = useState('')

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

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const handleFinish = useCallback((pts: number) => {
    if (pts > 0) {
      showToast(`+${pts} балів зараховано! ☕`)
    } else {
      showToast('Наступного разу пощастить!')
    }
    loadStatus()
    setTimeout(() => setGame('hub'), 2500)
  }, [loadStatus])

  const dailyUsed = status?.daily.current ?? 0
  const dailyMax = status?.daily.max ?? 60
  const progress = Math.min(100, Math.round((dailyUsed / dailyMax) * 100))

  // ── Ігровий екран ──────────────────────────────────────────────
  if (game !== 'hub') {
    const info = GAMES.find(g => g.id === game)!
    return (
      <div className="min-h-screen bg-[#FAF7F4]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-stone-200 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setGame('hub')}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors text-sm"
          >
            ←
          </button>
          <span className="font-semibold text-stone-800">{info.emoji} {info.name}</span>
        </div>

        <div className="max-w-md mx-auto py-4">
          {game === 'runner'    && <div className="px-4"><CoffeeJumpGame onGameOver={(s: number) => handleFinish(Math.min(Math.floor(s / 100), 10))} /></div>}
          {game === 'tictactoe' && <TicTacToe onFinish={handleFinish} />}
          {game === 'memory'    && <MemoryGame onFinish={handleFinish} />}
          {game === 'quiz'      && <QuizGame onFinish={handleFinish} />}
          {game === 'word'      && <WordPuzzle onFinish={handleFinish} />}
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
