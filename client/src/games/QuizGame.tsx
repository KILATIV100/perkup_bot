import { useState } from 'react'
import { gameApi } from '../lib/api'

const QUESTIONS = [
  { q: 'Яка температура ідеального еспресо?', a: ['85-90°C','60-70°C','95-100°C','75-80°C'], correct: 0 },
  { q: 'Звідки родом кава арабіка?', a: ['Ефіопія','Бразилія','Колумбія','В\'єтнам'], correct: 0 },
  { q: 'Що таке ристретто?', a: ['Міцний короткий еспресо','Кава з молоком','Холодна кава','Кава без кофеїну'], correct: 0 },
  { q: 'Скільки зерен потрібно на одну чашку еспресо?', a: ['40-50','5-10','100-120','20-25'], correct: 0 },
  { q: 'Яке місто вважається кавовою столицею світу?', a: ['Відень','Нью-Йорк','Сіетл','Стамбул'], correct: 0 },
  { q: 'Що означає слово "баріста"?', a: ['Людина за барною стійкою','Майстер кави','Власник кав\'ярні','Смажильник кави'], correct: 0 },
  { q: 'Де знаходяться кав\'ярні PerkUp?', a: ['Бровари','Київ','Харків','Одеса'], correct: 0 },
  { q: 'Як набрати рівень Silver у PerkUp?', a: ['300 балів','100 балів','500 балів','1000 балів'], correct: 0 },
  { q: 'Який напій роблять з кави та гарячого шоколаду?', a: ['Мокко','Американо','Капучіно','Флет уайт'], correct: 0 },
  { q: 'Скільки кофеїну в еспресо vs фільтр-каві?', a: ['Менше','Більше','Однаково','Залежить від сорту'], correct: 0 },
]

function prepareQuestion(q: typeof QUESTIONS[0]) {
  const shuffled = [...q.a].sort(() => Math.random()-0.5)
  const newCorrect = shuffled.indexOf(q.a[q.correct])
  return { q: q.q, a: shuffled, correct: newCorrect }
}

interface Props { onFinish: (pts: number) => void }

export default function QuizGame({ onFinish }: Props) {
  const [started, setStarted] = useState(false)
  const [question, setQuestion] = useState<ReturnType<typeof prepareQuestion> | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const [pts, setPts] = useState(0)

  const start = () => {
    const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]
    setQuestion(prepareQuestion(q))
    setSelected(null); setDone(false); setStarted(true)
  }

  const answer = async (i: number) => {
    if (selected !== null || !question) return
    setSelected(i)
    const correct = i === question.correct
    try {
      const res = await gameApi.finishGame('QUIZ', correct ? 1 : 0)
      const p = res.data?.pointsWon || 0
      setPts(p); onFinish(p)
    } catch {}
    setDone(true)
  }

  if (!started) return (
    <div className="text-center space-y-4 p-4">
      <div className="text-5xl">🎯</div>
      <h2 className="text-xl font-bold">Кавовий квіз</h2>
      <p className="text-sm text-gray-500">1 запитання на день · Правильна відповідь = 3 бали</p>
      <button onClick={start} className="w-full py-3 rounded-2xl bg-amber-700 text-white font-medium">Почати</button>
    </div>
  )

  if (!question) return null

  return (
    <div className="p-4 space-y-4">
      <div className="bg-amber-50 rounded-2xl p-4">
        <p className="font-medium text-center">{question.q}</p>
      </div>
      <div className="space-y-2">
        {question.a.map((ans, i) => {
          let cls = 'w-full text-left px-4 py-3 rounded-xl border-2 transition-all '
          if (selected !== null) {
            if (i === question.correct) cls += 'border-green-500 bg-green-50 text-green-800'
            else if (i === selected) cls += 'border-red-400 bg-red-50 text-red-700'
            else cls += 'border-gray-200 bg-gray-50 text-gray-400'
          } else {
            cls += 'border-gray-200 bg-white hover:border-amber-400 hover:bg-amber-50'
          }
          return <button key={i} onClick={() => answer(i)} className={cls}>{ans}</button>
        })}
      </div>
      {done && (
        <div className={`text-center p-3 rounded-xl ${pts > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {pts > 0 ? `✅ Правильно! +${pts} балів` : '❌ Неправильно. Завтра знову!'}
        </div>
      )}
    </div>
  )
}
