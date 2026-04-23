import { useState, useCallback, useRef } from 'react'
import { gameApi } from '../lib/api'

// Слова і підказки
const WORD_SETS = [
  {
    words: ['КАВА', 'ЛАТЕ', 'КРЕМА', 'ЗЕРНО', 'АРОМАТ'],
    hints: ['Улюблений напій ☕', 'Кава з молоком 🥛', 'Пінка на еспресо ✨', 'З чого варять каву 🫘', 'Запах кави 🌿'],
  },
  {
    words: ['ЕСПРЕСО', 'БАРИСТА', 'МОККО', 'КАПУЧІНО', 'АМЕРИКАНО'],
    hints: ['Основа всіх напоїв', 'Майстер кави', 'Кава з шоколадом', 'З молочною піною', 'Розбавлений водою'],
  },
  {
    words: ['ПЕРКАП', 'БОНУС', 'РІВЕНЬ', 'БАЛИ', 'СПІН'],
    hints: ['Наш додаток ☕', 'Нагорода за замовлення', 'Bronze Silver Gold', 'Накопичуєш їх', 'Колесо фортуни 🎡'],
  },
]

interface Props { onFinish: (pts: number) => void }

export default function WordPuzzle({ onFinish }: Props) {
  const [phase, setPhase] = useState<'menu' | 'playing' | 'result'>('menu')
  const [set] = useState(() => WORD_SETS[Math.floor(Math.random() * WORD_SETS.length)])
  const [found, setFound] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [pts, setPts] = useState(0)
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const msgTimeout = useRef<ReturnType<typeof setTimeout>>()

  const showMsg = (text: string, ok: boolean) => {
    clearTimeout(msgTimeout.current)
    setMsg({ text, ok })
    msgTimeout.current = setTimeout(() => setMsg(null), 2000)
  }

  const finish = useCallback(async (foundWords: string[]) => {
    setLoading(true)
    try {
      const res = await gameApi.finishGame('WORD_PUZZLE', foundWords.length)
      const earned = res.data?.pointsWon || res.data?.earnedPoints || 0
      setPts(earned)
      onFinish(earned)
    } catch { onFinish(0) }
    setLoading(false)
    setPhase('result')
  }, [onFinish])

  const checkWord = useCallback(async () => {
    const word = input.trim().toUpperCase().replace(/\s+/g, '')
    setInput('')
    inputRef.current?.focus()

    if (!word) return

    if (found.includes(word)) {
      showMsg('Це слово вже знайдено!', false)
      return
    }

    if (set.words.includes(word)) {
      const nf = [...found, word]
      setFound(nf)
      showMsg(`✅ «${word}» — правильно! +1 бал`, true)

      if (nf.length >= set.words.length) {
        await finish(nf)
      }
    } else {
      setShake(true)
      showMsg(`❌ «${word}» не в списку`, false)
      setTimeout(() => setShake(false), 400)
    }
  }, [input, found, set.words, finish])

  // ── Menu ──
  if (phase === 'menu') return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-5">
      <div className="w-24 h-24 bg-amber-50 rounded-3xl flex items-center justify-center text-5xl shadow-sm border border-amber-100">
        🧩
      </div>
      <div>
        <h2 className="text-2xl font-bold text-stone-800">Кавові слова</h2>
        <p className="text-stone-400 text-sm mt-1">Відгадай всі кавові слова за підказками</p>
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 w-full max-w-xs text-sm space-y-1">
        <div className="flex justify-between"><span className="text-stone-500">🎯 За кожне слово</span><span className="font-semibold text-amber-800">1 бал</span></div>
        <div className="flex justify-between"><span className="text-stone-500">🏆 Всі слова</span><span className="font-semibold text-amber-800">до 5 балів</span></div>
        <div className="flex justify-between border-t border-amber-100 pt-1 mt-1"><span className="text-stone-500">⏱ Cooldown</span><span className="font-semibold text-stone-500">4 год</span></div>
      </div>
      <button onClick={() => setPhase('playing')} className="w-full max-w-xs py-4 rounded-2xl bg-amber-800 text-white font-semibold text-lg shadow-md active:scale-95 transition-transform">
        Почати
      </button>
    </div>
  )

  // ── Result ──
  if (phase === 'result') return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-5">
      <div className="text-7xl">{found.length === set.words.length ? '🏆' : '👍'}</div>
      <div>
        <h2 className="text-2xl font-bold text-stone-800">
          {found.length === set.words.length ? 'Всі слова знайдено!' : `${found.length} з ${set.words.length} слів`}
        </h2>
        <div className="flex flex-wrap gap-2 justify-center mt-3">
          {set.words.map(w => (
            <span key={w} className={`px-3 py-1 rounded-full text-sm font-medium ${found.includes(w) ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-400 line-through'}`}>
              {w}
            </span>
          ))}
        </div>
      </div>
      {loading
        ? <div className="text-stone-400 text-sm animate-pulse">Зберігаємо...</div>
        : pts > 0
          ? <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-3 text-green-700 font-bold text-xl">+{pts} балів!</div>
          : <div className="bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 text-stone-500 text-sm">Спробуй наступного разу!</div>
      }
      <button onClick={() => onFinish(pts)} className="w-full max-w-xs py-4 rounded-2xl bg-amber-800 text-white font-semibold text-lg active:scale-95 transition-transform">
        До ігор
      </button>
    </div>
  )

  // ── Playing ──
  const remaining = set.words.length - found.length
  return (
    <div className="p-4 space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-500">Знайдено {found.length} / {set.words.length}</span>
        <div className="flex gap-1">
          {set.words.map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full transition-all ${i < found.length ? 'bg-green-500 scale-110' : 'bg-stone-200'}`} />
          ))}
        </div>
      </div>

      {/* Hints */}
      <div className="space-y-2">
        {set.words.map((word, i) => {
          const isSolved = found.includes(word)
          return (
            <div key={word} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${
              isSolved ? 'border-green-200 bg-green-50' : 'border-stone-100 bg-white'
            }`}>
              <span className="text-lg">{isSolved ? '✅' : `${i+1}.`}</span>
              <div className="flex-1">
                <p className={`text-sm ${isSolved ? 'text-stone-400' : 'text-stone-700'}`}>
                  {set.hints[i]}
                </p>
                {isSolved && (
                  <p className="text-xs font-bold text-green-700 mt-0.5">{word}</p>
                )}
              </div>
              {!isSolved && (
                <div className="text-xs text-stone-300 font-mono">
                  {'_ '.repeat(word.length).trim()}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div className={`flex gap-2 transition-all ${shake ? 'animate-[shake_0.4s_ease]' : ''}`}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && checkWord()}
          placeholder={`Введи слово... (${remaining} залишилось)`}
          className="flex-1 border-2 border-stone-200 rounded-2xl px-4 py-3 text-sm bg-white focus:border-amber-400 focus:outline-none transition-colors"
          autoCapitalize="characters"
          disabled={phase !== 'playing'}
        />
        <button
          onClick={checkWord}
          disabled={!input.trim()}
          className="px-5 rounded-2xl bg-amber-800 text-white text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all"
        >
          OK
        </button>
      </div>

      {/* Message */}
      {msg && (
        <div className={`text-center py-2 px-4 rounded-xl text-sm font-medium transition-all ${
          msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
        }`}>
          {msg.text}
        </div>
      )}

      {/* Found words */}
      {found.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {found.map(w => (
            <span key={w} className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
              {w} ✓
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
