import { useState, useRef } from 'react'
import { gameApi } from '../lib/api'

interface Question {
  q: string
  options: string[]
  correct: number
  explanation?: string
}

// Фолбек-питання якщо AI недоступний
const FALLBACK: Question[] = [
  { q: 'Яка температура води для ідеального еспресо?', options: ['88–92°C','60–70°C','95–100°C','75–82°C'], correct: 0, explanation: 'Занадто гаряча вода спалює зерно, занадто холодна — недоекстрагує.' },
  { q: 'З якої країни походить кава арабіка?', options: ['Ефіопія','Бразилія','Колумбія',"В'єтнам"], correct: 0, explanation: 'Арабіка вперше була знайдена в Ефіопії, у регіоні Каффа.' },
  { q: 'Що таке ристретто?', options: ['Короткий концентрований еспресо','Кава з молоком','Холодна кава','Кава без кофеїну'], correct: 0, explanation: 'Ристретто = «обмежений» — менше води, більш концентрований смак.' },
  { q: 'Яке місто вважається кавовою столицею Австрії?', options: ['Відень','Зальцбург','Грац','Лінц'], correct: 0, explanation: 'Відень — батьківщина кавових будинків (Kaffeehäuser), традиція з XVII ст.' },
  { q: 'Скільки балів дає рівень Silver у PerkUp?', options: ['Від 300 балів','Від 100','Від 500','Від 1000'], correct: 0 },
  { q: 'Що означає "доппіо"?', options: ['Подвійний еспресо','Кава з льодом','Молочна піна','Кава без кофеїну'], correct: 0, explanation: 'Доппіо — просто подвійна порція еспресо.' },
  { q: 'Який відсоток від чеку нараховується на рівні Gold у PerkUp?', options: ['1.5%','1%','2%','0.5%'], correct: 0 },
  { q: 'Скільки замовлень потрібно для безкоштовного спіну в PerkUp?', options: ['5','3','10','7'], correct: 0 },
  { q: 'Що таке "флет уайт"?', options: ['Еспресо з молоком без піни','Капучіно без цукру','Американо з вершками','Кава по-ірландськи'], correct: 0, explanation: 'Флет уайт — австралійський напій: щільне мікро-піниться молоко та подвійний еспресо.' },
  { q: 'Яка локація PerkUp знаходиться в Крона Парк 2?', options: ['ЖК Крона Парк 2','ТЦ Марк Молл','Парк Приозерний','Старе місто'], correct: 0 },
]

async function generateAIQuestion(): Promise<Question | null> {
  try {
    const topics = [
      'факти про каву (хімія, виробництво, сорти)',
      'рецепти та техніки приготування кави',
      'кавова культура різних країн',
      'PerkUp — бали, рівні, бонуси',
      'кавове обладнання (рожки, пуровери, аеропреси)',
      'цікаві факти про кофеїн та здоров\'я',
    ]
    const topic = topics[Math.floor(Math.random() * topics.length)]

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: 'Ти генеруєш питання для кавового квізу в Telegram Mini App PerkUp. Відповідай ТІЛЬКИ валідним JSON без markdown. Мова: українська.',
        messages: [{
          role: 'user',
          content: `Згенеруй 1 питання на тему: "${topic}".
JSON формат (без коментарів, без markdown):
{"q":"питання","options":["правильна","неправ1","неправ2","неправ3"],"correct":0,"explanation":"коротке пояснення 1 реченням"}
Правила: правильна відповідь ЗАВЖДИ перша (correct:0), питання не надто просте і не надто складне.`
        }],
      }),
    })

    if (!resp.ok) return null
    const data = await resp.json()
    const text = data.content?.[0]?.text?.trim() || ''

    // Витягуємо JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])

    if (!parsed.q || !Array.isArray(parsed.options) || parsed.options.length !== 4) return null

    // Перемішуємо відповіді
    const options = [...parsed.options]
    const correctAnswer = options[0]
    // Fisher-Yates
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]]
    }
    const correctIdx = options.indexOf(correctAnswer)

    return { q: parsed.q, options, correct: correctIdx, explanation: parsed.explanation }
  } catch {
    return null
  }
}

interface Props { onFinish: (pts: number) => void }

export default function QuizGame({ onFinish }: Props) {
  const [phase, setPhase] = useState<'menu' | 'loading' | 'playing' | 'result'>('menu')
  const [question, setQuestion] = useState<Question | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [isCorrect, setIsCorrect] = useState(false)
  const [pts, setPts] = useState(0)
  const [saving, setSaving] = useState(false)
  const [isAI, setIsAI] = useState(false)
  const usedFallbacks = useRef<Set<number>>(new Set())

  const loadQuestion = async () => {
    setPhase('loading')
    setSelected(null); setIsCorrect(false); setPts(0)

    // Пробуємо AI
    const aiQ = await generateAIQuestion()
    if (aiQ) {
      setQuestion(aiQ); setIsAI(true); setPhase('playing'); return
    }

    // Фолбек — рандомне питання якого ще не було
    setIsAI(false)
    const available = FALLBACK.map((_, i) => i).filter(i => !usedFallbacks.current.has(i))
    const pool = available.length > 0 ? available : FALLBACK.map((_, i) => i)
    const idx = pool[Math.floor(Math.random() * pool.length)]
    usedFallbacks.current.add(idx)

    const q = FALLBACK[idx]
    // Перемішуємо відповіді
    const options = [...q.options]
    const correctAnswer = options[q.correct]
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]]
    }
    setQuestion({ q: q.q, options, correct: options.indexOf(correctAnswer), explanation: q.explanation })
    setPhase('playing')
  }

  const answer = async (i: number) => {
    if (selected !== null || !question || saving) return
    setSelected(i)
    const correct = i === question.correct
    setIsCorrect(correct)
    setSaving(true)
    try {
      const res = await gameApi.finish('QUIZ', correct ? 1 : 0)
      setPts(res.data?.pointsWon || res.data?.earnedPoints || 0)
    } catch {}
    setSaving(false)
    setTimeout(() => setPhase('result'), 1400)
  }

  // ── Menu ──
  if (phase === 'menu') return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-5">
      <div className="w-24 h-24 bg-amber-50 rounded-3xl flex items-center justify-center text-5xl shadow-sm border border-amber-100">🎯</div>
      <div>
        <h2 className="text-2xl font-bold text-stone-800">Кавовий квіз</h2>
        <p className="text-stone-400 text-sm mt-1">Питання від AI про каву та PerkUp</p>
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 w-full max-w-xs text-sm space-y-1">
        <div className="flex justify-between"><span className="text-stone-500">✅ Правильна відповідь</span><span className="font-semibold text-amber-800">3 бали</span></div>
        <div className="flex justify-between"><span className="text-stone-500">❌ Неправильна</span><span className="font-semibold text-stone-400">0 балів</span></div>
        <div className="flex justify-between border-t border-amber-100 pt-1 mt-1"><span className="text-stone-500">📅 Ліміт</span><span className="font-semibold text-stone-500">10 разів/день</span></div>
        <div className="flex justify-between"><span className="text-stone-500">🤖 Генерація</span><span className="font-semibold text-stone-500">AI / база</span></div>
      </div>
      <button onClick={loadQuestion} className="w-full max-w-xs py-4 rounded-2xl bg-amber-800 text-white font-semibold text-lg shadow-md active:scale-95 transition-transform">
        Отримати питання
      </button>
    </div>
  )

  // ── Loading ──
  if (phase === 'loading') return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-4">
      <div className="text-5xl animate-spin">☕</div>
      <p className="text-stone-600 font-medium">AI готує питання...</p>
      <p className="text-stone-400 text-xs">Секунду</p>
    </div>
  )

  // ── Result ──
  if (phase === 'result') return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-5">
      <div className="text-7xl">{isCorrect ? '🎉' : '😅'}</div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-stone-800">{isCorrect ? 'Правильно!' : 'Не вірно!'}</h2>
        {question && !isCorrect && (
          <p className="text-stone-500 text-sm">
            Правильна: <span className="font-semibold text-amber-700">{question.options[question.correct]}</span>
          </p>
        )}
        {question?.explanation && (
          <p className="text-stone-400 text-xs italic max-w-xs mx-auto">{question.explanation}</p>
        )}
      </div>
      {isCorrect && pts > 0
        ? <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-3 text-green-700 font-bold text-xl">+{pts} балів!</div>
        : <div className="bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 text-stone-500 text-sm">Наступне питання!</div>
      }
      <div className="flex gap-3 w-full max-w-xs">
        <button onClick={loadQuestion} className="flex-1 py-3 rounded-2xl bg-amber-800 text-white font-semibold active:scale-95 transition-transform">
          Ще питання
        </button>
        <button onClick={() => onFinish(pts)} className="flex-1 py-3 rounded-2xl bg-stone-100 text-stone-700 font-semibold active:scale-95 transition-transform">
          До ігор
        </button>
      </div>
    </div>
  )

  // ── Playing ──
  if (!question) return null
  return (
    <div className="p-4 space-y-5">
      {isAI && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          <span>🤖</span><span>Питання згенеровано AI</span>
        </div>
      )}
      <div className="bg-gradient-to-br from-amber-800 to-stone-800 rounded-2xl p-5 text-white text-center shadow-md">
        <p className="text-xs text-amber-200 mb-2 uppercase tracking-wider font-medium">Запитання</p>
        <p className="font-semibold text-base leading-snug">{question.q}</p>
      </div>
      <div className="space-y-2.5">
        {question.options.map((opt, i) => {
          let cls = 'w-full text-left px-4 py-4 rounded-2xl border-2 text-sm font-medium transition-all duration-300 '
          if (selected !== null) {
            if (i === question.correct) cls += 'border-green-400 bg-green-50 text-green-800 scale-[1.02]'
            else if (i === selected && !isCorrect) cls += 'border-red-400 bg-red-50 text-red-700'
            else cls += 'border-stone-200 bg-stone-50 text-stone-400'
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
      {saving && <p className="text-center text-stone-400 text-sm animate-pulse">Зберігаємо...</p>}
    </div>
  )
}
