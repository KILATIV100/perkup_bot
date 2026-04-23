import { useState, useEffect, useCallback, useRef } from 'react'
import { gameApi } from '../lib/api'

const EMOJIS = ['☕','🧁','🍩','🥐','🍫','🫖','🥛','🧇']
const ALL_CARDS = [...EMOJIS, ...EMOJIS]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Скільки балів залежно від часу
function calcPoints(secs: number): number {
  if (secs <= 20) return 5
  if (secs <= 35) return 4
  if (secs <= 50) return 3
  if (secs <= 75) return 2
  return 1
}

interface Props { onFinish: (pts: number) => void }

export default function MemoryGame({ onFinish }: Props) {
  const [cards, setCards] = useState<string[]>([])
  const [flipped, setFlipped] = useState<number[]>([])
  const [matched, setMatched] = useState<Set<number>>(new Set())
  const [checking, setChecking] = useState(false) // блокує зайві кліки
  const [moves, setMoves] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [phase, setPhase] = useState<'menu'|'playing'|'result'>('menu')
  const [pts, setPts] = useState(0)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval>>()
  const startRef = useRef(0)

  const startGame = () => {
    setCards(shuffle(ALL_CARDS))
    setFlipped([]); setMatched(new Set()); setChecking(false)
    setMoves(0); setElapsed(0); setPts(0)
    setPhase('playing')
    startRef.current = Date.now()
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000))
    }, 1000)
  }

  const finish = useCallback(async (secs: number) => {
    clearInterval(timerRef.current)
    setLoading(true)
    try {
      const res = await gameApi.finishGame('MEMORY', secs)
      const earned = res.data?.pointsWon || res.data?.earnedPoints || 0
      setPts(earned)
      onFinish(earned)
    } catch { onFinish(0) }
    setLoading(false)
    setPhase('result')
  }, [onFinish])

  // Перевірка завершення — через useEffect після оновлення matched
  const matchedRef = useRef<Set<number>>(new Set())
  useEffect(() => {
    matchedRef.current = matched
    if (matched.size === ALL_CARDS.length && phase === 'playing') {
      const secs = Math.floor((Date.now() - startRef.current) / 1000)
      finish(secs)
    }
  }, [matched, phase, finish])

  const flip = useCallback((i: number) => {
    if (checking || flipped.includes(i) || matched.has(i) || phase !== 'playing') return
    if (flipped.length === 2) return // вже 2 відкриті, чекаємо

    const nf = [...flipped, i]
    setFlipped(nf)

    if (nf.length === 2) {
      setMoves(m => m + 1)
      setChecking(true)
      if (cards[nf[0]] === cards[nf[1]]) {
        // Пара знайдена!
        setTimeout(() => {
          setMatched(prev => new Set([...prev, nf[0], nf[1]]))
          setFlipped([])
          setChecking(false)
        }, 400)
      } else {
        // Не пара — перевертаємо назад через 900мс
        setTimeout(() => {
          setFlipped([])
          setChecking(false)
        }, 900)
      }
    }
  }, [checking, flipped, matched, phase, cards])

  // Очищаємо таймер при unmount
  useEffect(() => () => clearInterval(timerRef.current), [])

  const expectedPts = phase === 'playing' ? calcPoints(elapsed) : pts

  // ── Menu ──
  if (phase === 'menu') return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-5">
      <div className="w-24 h-24 bg-amber-50 rounded-3xl flex items-center justify-center text-5xl shadow-sm border border-amber-100">
        🃏
      </div>
      <div>
        <h2 className="text-2xl font-bold text-stone-800">Кавова пам'ять</h2>
        <p className="text-stone-400 text-sm mt-1">Знайди всі 8 пар якомога швидше</p>
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 w-full max-w-xs text-sm space-y-1">
        <div className="flex justify-between"><span className="text-stone-500">⚡ До 20 сек</span><span className="font-semibold text-amber-800">5 балів</span></div>
        <div className="flex justify-between"><span className="text-stone-500">🏃 До 35 сек</span><span className="font-semibold text-amber-800">4 бали</span></div>
        <div className="flex justify-between"><span className="text-stone-500">🚶 До 50 сек</span><span className="font-semibold text-amber-800">3 бали</span></div>
        <div className="flex justify-between"><span className="text-stone-500">🐢 До 75 сек</span><span className="font-semibold text-amber-800">2 бали</span></div>
        <div className="flex justify-between"><span className="text-stone-500">🐌 Більше</span><span className="font-semibold text-amber-800">1 бал</span></div>
        <div className="flex justify-between border-t border-amber-100 pt-1 mt-1"><span className="text-stone-500">⏱ Cooldown</span><span className="font-semibold text-stone-500">4 год</span></div>
      </div>
      <button onClick={startGame} className="w-full max-w-xs py-4 rounded-2xl bg-amber-800 text-white font-semibold text-lg shadow-md active:scale-95 transition-transform">
        Почати
      </button>
    </div>
  )

  // ── Result ──
  if (phase === 'result') return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-5">
      <div className="text-7xl">🏆</div>
      <div>
        <h2 className="text-2xl font-bold text-stone-800">Знайдено всі пари!</h2>
        <p className="text-stone-400 text-sm mt-1">{moves} ходів · {elapsed} секунд</p>
      </div>
      {loading
        ? <div className="text-stone-400 text-sm animate-pulse">Зберігаємо результат...</div>
        : <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-3 text-green-700 font-bold text-xl">+{pts} балів!</div>
      }
      <button onClick={startGame} className="w-full max-w-xs py-4 rounded-2xl bg-amber-800 text-white font-semibold text-lg active:scale-95 transition-transform">
        Ще раз
      </button>
    </div>
  )

  // ── Playing ──
  const pairsFound = matched.size / 2
  return (
    <div className="p-3">
      {/* HUD */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-1 text-sm text-stone-500">
          <span>⏱</span>
          <span className={`font-mono font-bold ${elapsed > 50 ? 'text-red-500' : elapsed > 35 ? 'text-amber-600' : 'text-green-600'}`}>
            {elapsed}с
          </span>
        </div>
        <div className="text-sm font-medium text-stone-700">
          ✅ {pairsFound} / {EMOJIS.length}
        </div>
        <div className="text-sm text-stone-500">
          {moves} ходів · ~{expectedPts}б
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-4 gap-2 max-w-[320px] mx-auto">
        {cards.map((emoji, i) => {
          const isFlipped = flipped.includes(i)
          const isMatched = matched.has(i)
          const show = isFlipped || isMatched
          return (
            <button
              key={i}
              onClick={() => flip(i)}
              disabled={isMatched || checking && !isFlipped}
              className={`h-[72px] rounded-xl text-2xl font-bold border-2 transition-all duration-300 select-none ${
                isMatched
                  ? 'bg-green-50 border-green-300 scale-95 opacity-70'
                  : isFlipped
                    ? 'bg-amber-50 border-amber-400 scale-105'
                    : 'bg-white border-stone-200 hover:bg-amber-50 hover:border-amber-200 active:scale-95'
              }`}
            >
              {show ? emoji : '☕'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
