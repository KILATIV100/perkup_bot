import { useState, useEffect, useCallback, useRef } from 'react'
import { gameApi } from '../lib/api'

const CARDS = ['☕','🧁','🍩','🥐','🍫','🫖','🥛','🧇']
const ALL = [...CARDS,...CARDS]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]] }
  return a
}

interface Props { onFinish: (pts: number) => void }

export default function MemoryGame({ onFinish }: Props) {
  const [cards, setCards] = useState<string[]>([])
  const [flipped, setFlipped] = useState<number[]>([])
  const [matched, setMatched] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [pts, setPts] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>()
  const startTimeRef = useRef<number>(0)

  const start = () => {
    setCards(shuffle(ALL))
    setFlipped([]); setMatched([]); setMoves(0); setDone(false); setElapsed(0)
    setStarted(true)
    startTimeRef.current = Date.now()
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now()-startTimeRef.current)/1000)), 1000)
  }

  const finish = useCallback(async (secs: number) => {
    clearInterval(timerRef.current)
    try {
      const res = await gameApi.finishGame('MEMORY', secs)
      const p = res.data?.pointsWon || 0
      setPts(p); onFinish(p)
    } catch {}
    setDone(true)
  }, [onFinish])

  useEffect(() => {
    if (matched.length === ALL.length && started && !done) {
      finish(elapsed)
    }
  }, [matched, started, done, elapsed, finish])

  const flip = (i: number) => {
    if (flipped.length === 2 || flipped.includes(i) || matched.includes(i)) return
    const nf = [...flipped, i]
    setFlipped(nf)
    if (nf.length === 2) {
      setMoves(m => m+1)
      if (cards[nf[0]] === cards[nf[1]]) {
        setMatched(m => [...m, nf[0], nf[1]])
        setFlipped([])
      } else {
        setTimeout(() => setFlipped([]), 900)
      }
    }
  }

  if (!started) return (
    <div className="text-center space-y-4 p-4">
      <div className="text-5xl">🃏</div>
      <h2 className="text-xl font-bold">Кавова пам'ять</h2>
      <p className="text-sm text-gray-500">Знайди всі пари · Чим швидше — тим більше балів</p>
      <div className="text-xs text-gray-400">Max 5 балів · Cooldown 4 год</div>
      <button onClick={start} className="w-full py-3 rounded-2xl bg-amber-700 text-white font-medium">Почати</button>
    </div>
  )

  if (done) return (
    <div className="text-center space-y-4 p-4">
      <div className="text-5xl">🏆</div>
      <h2 className="text-xl font-bold">Молодець!</h2>
      <p className="text-gray-600">{moves} ходів · {elapsed} сек</p>
      {pts > 0 && <p className="text-green-600 font-medium">+{pts} балів!</p>}
      <button onClick={start} className="w-full py-3 rounded-2xl bg-amber-700 text-white">Ще раз</button>
    </div>
  )

  return (
    <div className="p-3">
      <div className="flex justify-between text-sm text-gray-500 mb-3">
        <span>⏱ {elapsed}с</span><span>Ходів: {moves}</span><span>✅ {matched.length/2}/{CARDS.length}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {cards.map((card, i) => {
          const show = flipped.includes(i) || matched.includes(i)
          return (
            <button key={i} onClick={() => flip(i)}
              className={`h-16 rounded-xl text-2xl transition-all duration-300 ${
                matched.includes(i) ? 'bg-green-100 border-2 border-green-400' :
                show ? 'bg-amber-50 border-2 border-amber-300' : 'bg-amber-100 border-2 border-amber-200'
              }`}>
              {show ? card : '☕'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
