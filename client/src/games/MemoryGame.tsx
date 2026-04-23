import { useState, useEffect, useCallback, useRef } from 'react'
import { gameApi } from '../lib/api'

const EMOJIS = ['☕','🧁','🍩','🥐','🍫','🫖','🥛','🧇']

interface Card { emoji: string; pairId: number }

function makeCards(): Card[] {
  // Кожна emoji з'являється рівно 2 рази, з однаковим pairId
  const cards: Card[] = EMOJIS.flatMap((emoji, i) => [
    { emoji, pairId: i },
    { emoji, pairId: i },
  ])
  // Fisher-Yates shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]]
  }
  return cards
}

function calcPoints(secs: number): number {
  if (secs <= 20) return 5
  if (secs <= 35) return 4
  if (secs <= 50) return 3
  if (secs <= 75) return 2
  return 1
}

interface Props { onFinish: (pts: number) => void }

export default function MemoryGame({ onFinish }: Props) {
  const [phase, setPhase] = useState<'menu' | 'playing' | 'result'>('menu')
  const [cards, setCards] = useState<Card[]>([])
  const [gameKey, setGameKey] = useState(0) // для reset React keys
  const [flipped, setFlipped] = useState<number[]>([])
  const [matched, setMatched] = useState<number[]>([]) // pairIds що знайдені
  const [checking, setChecking] = useState(false)
  const [moves, setMoves] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [pts, setPts] = useState(0)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval>>()
  const startRef = useRef(0)

  const startGame = () => {
    clearInterval(timerRef.current)
    setCards(makeCards())
    setGameKey(k => k + 1)
    setFlipped([]); setMatched([]); setChecking(false)
    setMoves(0); setElapsed(0); setPts(0); setLoading(false)
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
      setPts(earned); onFinish(earned)
    } catch { onFinish(0) }
    setLoading(false)
    setPhase('result')
  }, [onFinish])

  useEffect(() => () => clearInterval(timerRef.current), [])

  const flip = useCallback((idx: number) => {
    if (checking || flipped.includes(idx) || matched.includes(cards[idx]?.pairId) || phase !== 'playing') return
    if (flipped.length >= 2) return

    const next = [...flipped, idx]
    setFlipped(next)

    if (next.length === 2) {
      setMoves(m => m + 1)
      setChecking(true)
      const [a, b] = next
      if (cards[a].pairId === cards[b].pairId) {
        // Пара знайдена!
        const newMatched = [...matched, cards[a].pairId]
        setTimeout(() => {
          setMatched(newMatched)
          setFlipped([])
          setChecking(false)
          // Перевіряємо завершення
          if (newMatched.length === EMOJIS.length) {
            const secs = Math.floor((Date.now() - startRef.current) / 1000)
            finish(secs)
          }
        }, 350)
      } else {
        // Не пара — перевертаємо назад
        setTimeout(() => {
          setFlipped([])
          setChecking(false)
        }, 900)
      }
    }
  }, [checking, flipped, matched, cards, phase, finish])

  const pairsFound = matched.length
  const totalPairs = EMOJIS.length
  const expectedPts = calcPoints(elapsed)

  // ── Menu ──
  if (phase === 'menu') return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-5">
      <div className="w-24 h-24 bg-amber-50 rounded-3xl flex items-center justify-center text-5xl shadow-sm border border-amber-100">🃏</div>
      <div>
        <h2 className="text-2xl font-bold text-stone-800">Кавова пам'ять</h2>
        <p className="text-stone-400 text-sm mt-1">Знайди всі 8 пар якомога швидше</p>
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 w-full max-w-xs text-sm space-y-1">
        {[['⚡ До 20 сек','5 балів'],['🏃 До 35 сек','4 бали'],['🚶 До 50 сек','3 бали'],['🐢 До 75 сек','2 бали'],['🐌 Більше','1 бал']].map(([l,r])=>(
          <div key={l} className="flex justify-between"><span className="text-stone-500">{l}</span><span className="font-semibold text-amber-800">{r}</span></div>
        ))}
        <div className="flex justify-between border-t border-amber-100 pt-1 mt-1"><span className="text-stone-500">⏱ Cooldown</span><span className="font-semibold text-stone-500">4 год</span></div>
      </div>
      <button onClick={startGame} className="w-full max-w-xs py-4 rounded-2xl bg-amber-800 text-white font-semibold text-lg shadow-md active:scale-95 transition-transform">Почати</button>
    </div>
  )

  // ── Result ──
  if (phase === 'result') return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-5">
      <div className="text-7xl">🏆</div>
      <div>
        <h2 className="text-2xl font-bold text-stone-800">Всі пари знайдено!</h2>
        <p className="text-stone-400 text-sm mt-1">{moves} ходів · {elapsed} секунд</p>
      </div>
      {loading
        ? <div className="text-stone-400 text-sm animate-pulse">Зберігаємо...</div>
        : <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-3 text-green-700 font-bold text-xl">+{pts} балів!</div>
      }
      <button onClick={startGame} className="w-full max-w-xs py-4 rounded-2xl bg-amber-800 text-white font-semibold text-lg active:scale-95 transition-transform">Ще раз</button>
    </div>
  )

  // ── Playing ──
  return (
    <div className="p-3">
      {/* HUD */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className={`font-mono font-bold text-sm tabular-nums ${elapsed > 50 ? 'text-red-500' : elapsed > 35 ? 'text-amber-600' : 'text-green-600'}`}>
          ⏱ {elapsed}с
        </span>
        <span className="text-sm font-medium text-stone-600">✅ {pairsFound}/{totalPairs}</span>
        <span className="text-sm text-stone-400">{moves} ходів · ~{expectedPts}б</span>
      </div>

      {/* Cards — key={gameKey} щоб React точно перемальовував при рестарті */}
      <div key={gameKey} className="grid grid-cols-4 gap-2 max-w-[340px] mx-auto">
        {cards.map((card, i) => {
          const isFlipped = flipped.includes(i)
          const isMatched = matched.includes(card.pairId)
          const show = isFlipped || isMatched
          return (
            <button
              key={i}
              onClick={() => flip(i)}
              disabled={isMatched || (checking && !isFlipped)}
              className={`h-[70px] rounded-xl text-2xl border-2 transition-all duration-300 select-none ${
                isMatched
                  ? 'bg-green-50 border-green-300 opacity-60 scale-95'
                  : isFlipped
                    ? 'bg-white border-amber-400 shadow-md scale-105'
                    : 'bg-amber-50 border-amber-200 hover:border-amber-400 hover:bg-white active:scale-95'
              }`}
            >
              {show ? card.emoji : '☕'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
