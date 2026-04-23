import { useState } from 'react'
import { gameApi } from '../lib/api'

const QUESTIONS = [
  { q: 'Яка температура ідеального еспресо при заварюванні?', options: ['85–92°C', '60–70°C', '95–100°C', '75–80°C'], correct: 0 },
  { q: 'З якої країни походить кава арабіка?', options: ['Ефіопія', 'Бразилія', 'Колумбія', "В'єтнам"], correct: 0 },
  { q: 'Що таке ристретто?', options: ['Короткий концентрований еспресо', 'Кава з молоком', 'Холодна кава', 'Кава без кофеїну'], correct: 0 },
  { q: 'Яке місто вважається кавовою столицею Європи?', options: ['Відень', 'Рим', 'Стамбул', 'Амстердам'], correct: 0 },
  { q: 'Де знаходяться кав\'ярні PerkUp?', options: ['Бровари', 'Київ', 'Харків', 'Львів'], correct: 0 },
  { q: 'Скільки балів дає рівень Silver у PerkUp?', options: ['Від 300 балів', 'Від 100', 'Від 500', 'Від 1000'], correct: 0 },
  { q: 'Який напій готують з еспресо та гарячого шоколаду?', options: ['Мокко', 'Американо', 'Флет уайт', 'Макіато'], correct: 0 },
  { q: 'Що означає "доппіо"?', options: ['Подвійний еспресо', 'Кава з льодом', 'Молочна піна', 'Без кофеїну'], correct: 0 },
  { q: 'Яку каву готують без додавання молока?', options: ['Американо', 'Капучіно', 'Лате', 'Мокіато'], correct: 0 },
  { q: 'Скільки відсотків від чеку дає рівень Gold у PerkUp?', options: ['1.5%', '1%', '2%', '0.5%'], correct: 0 },
]

function prepare(q: typeof QUESTIONS[0]) {
  // Перемішуємо варіанти, запам'ятовуємо де правильний
  const indices = [0, 1, 2, 3]
  for (let i = 3; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]]
  }
  const shuffled = indices.map(i => q.options[i])
  const correctIdx = shuffled.indexOf(q.options[q.correct])
  return { q: q.q, options: shuffled, correct: correctIdx }
}

interface Props { onFinish: (pts: number) => void }

export default function QuizGame({ onFinish }: Props) {
  const [phase, setPhase] = useState<'menu'|'playing'|'result'>('menu')
  const [question, setQuestion] = useState<ReturnType<typeof prepare> | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [isCorrect, setIsCorrect] = useState(false)
  const [pts, setPts] = useState(0)
  const [loading, setLoading] = useState(false)

  const startGame = () => {
    const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]
    setQuestion(prepare(q))
    setSelected(null); setIsCorrect(false); setPts(0)
    setPhase('playing')
  }

  const answer = async (i: number) => {
    if (selected !== null || !question || loading) return
    setSelected(i)
    const correct = i === question.correct
    setIsCorrect(correct)
    setLoading(true)
    try {
      const res = await gameApi.finishGame('QUIZ', correct ? 1 : 0)
      const earned = res.data?.pointsWon || res.data?.earnedPoints || 0
      setPts(earned)
    } catch {}
    setLoading(false)
    // Показуємо результат через 1.5с
    setTimeout(() => {
      setPhase('result')
      // Повертаємось у хаб тільки якщо правильно (бали є)
      // onFinish викликаємо завжди, але значення балів
    }, 1500)
  }

  // ── Menu ──
  if (phase === 'menu') return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-5">
      <div className="w-24 h-24 bg-amber-50 rounded-3xl flex items-center justify-center text-5xl shadow-sm border border-amber-100">
        🎯
      </div>
      <div>
        <h2 className="text-2xl font-bold text-stone-800">Кавовий квіз</h2>
        <p className="text-stone-400 text-sm mt-1">1 запитання про каву та PerkUp</p>
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 w-full max-w-xs text-sm space-y-1">
        <div className="flex justify-between"><span className="text-stone-500">✅ Правильна відповідь</span><span className="font-semibold text-amber-800">3 бали</span></div>
        <div className="flex justify-between"><span className="text-stone-500">❌ Неправильна</span><span className="font-semibold text-stone-400">0 балів</span></div>
        <div className="flex justify-between border-t border-amber-100 pt-1 mt-1"><span className="text-stone-500">📅 Cooldown</span><span className="font-semibold text-stone-500">1 раз на день</span></div>
      </div>
      <button onClick={startGame} className="w-full max-w-xs py-4 rounded-2xl bg-amber-800 text-white font-semibold text-lg shadow-md active:scale-95 transition-transform">
        Отримати запитання
      </button>
    </div>
  )

  // ── Result ──
  if (phase === 'result') return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-5">
      <div className="text-7xl">{isCorrect ? '🎉' : '😅'}</div>
      <div>
        <h2 className="text-2xl font-bold text-stone-800">{isCorrect ? 'Правильно!' : 'Не вірно!'}</h2>
        {question && !isCorrect && (
          <p className="text-stone-500 text-sm mt-2">
            Правильна відповідь: <span className="font-semibold text-amber-700">{question.options[question.correct]}</span>
          </p>
        )}
      </div>
      {isCorrect && pts > 0
        ? <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-3 text-green-700 font-bold text-xl">+{pts} балів!</div>
        : <div className="bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 text-stone-500 text-sm">Спробуй завтра ще раз</div>
      }
      <button
        onClick={() => onFinish(pts)}
        className="w-full max-w-xs py-4 rounded-2xl bg-amber-800 text-white font-semibold text-lg active:scale-95 transition-transform"
      >
        До ігор
      </button>
    </div>
  )

  // ── Playing ──
  if (!question) return null
  return (
    <div className="p-4 space-y-5">
      {/* Question */}
      <div className="bg-gradient-to-br from-amber-800 to-stone-800 rounded-2xl p-5 text-white text-center shadow-md">
        <p className="text-xs text-amber-200 mb-2 uppercase tracking-wider">Запитання</p>
        <p className="font-semibold text-base leading-snug">{question.q}</p>
      </div>

      {/* Answers */}
      <div className="space-y-2.5">
        {question.options.map((opt, i) => {
          let cls = 'w-full text-left px-4 py-4 rounded-2xl border-2 text-sm font-medium transition-all duration-300 '
          if (selected !== null) {
            if (i === question.correct) {
              cls += 'border-green-400 bg-green-50 text-green-800 scale-[1.02]'
            } else if (i === selected && !isCorrect) {
              cls += 'border-red-400 bg-red-50 text-red-700'
            } else {
              cls += 'border-stone-200 bg-stone-50 text-stone-400'
            }
          } else {
            cls += 'border-stone-200 bg-white text-stone-700 hover:border-amber-400 hover:bg-amber-50 active:scale-95'
          }
          return (
            <button key={i} onClick={() => answer(i)} disabled={selected !== null} className={cls}>
              <span className="mr-3 text-stone-400 font-mono text-xs">{String.fromCharCode(65+i)}.</span>
              {opt}
              {selected !== null && i === question.correct && <span className="float-right">✅</span>}
              {selected !== null && i === selected && !isCorrect && <span className="float-right">❌</span>}
            </button>
          )
        })}
      </div>

      {loading && <p className="text-center text-stone-400 text-sm animate-pulse">Зберігаємо результат...</p>}
    </div>
  )
}
