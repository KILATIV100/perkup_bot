import { useState, useCallback } from 'react'
import { gameApi } from '../lib/api'

const PUZZLES = [
  {
    grid: ['К','А','В','А','Л','А','Т','Т','Е','Е','А','Р','О','М','А','Т','Г','Л','Я','Т','Е','К','П','С','А'],
    size: 5,
    words: ['КАВА','ЛАТЕ','АРОМАТ','КАП'],
  },
  {
    grid: ['Е','С','П','Р','Е','С','О','А','М','О','К','А','Ч','И','Н','О','Б','А','Р','И','С','Т','А','Л','І'],
    size: 5,
    words: ['ЕСПРЕСО','МОКАЧИНО','БАРИСТА'],
  },
]

interface Props { onFinish: (pts: number) => void }

export default function WordPuzzle({ onFinish }: Props) {
  const [puzzle] = useState(() => PUZZLES[Math.floor(Math.random()*PUZZLES.length)])
  const [found, setFound] = useState<string[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false)
  const [totalPts, setTotalPts] = useState(0)

  const toggleCell = (i: number) => {
    if (done) return
    setSelected(prev => prev.includes(i) ? prev.filter(x=>x!==i) : [...prev, i])
  }

  const checkAndFinish = useCallback(async (newFound: string[]) => {
    if (newFound.length >= puzzle.words.length) {
      try {
        const res = await gameApi.finishGame('WORD_PUZZLE', newFound.length)
        const pts = res.data?.pointsWon || 0
        setTotalPts(pts); onFinish(pts)
      } catch {}
      setDone(true)
      setMsg('🎉 Всі слова знайдено!')
    }
  }, [puzzle, onFinish])

  const check = useCallback(async () => {
    const word = selected.map(i => puzzle.grid[i]).join('')
    setSelected([])
    if (puzzle.words.includes(word) && !found.includes(word)) {
      const nf = [...found, word]
      setFound(nf)
      setTotalPts(p => p+1)
      setMsg('✅ ' + word + '! +1 бал')
      await checkAndFinish(nf)
    } else if (found.includes(word)) {
      setMsg('Це слово вже знайдено')
    } else {
      setMsg('Не знайдено')
    }
  }, [selected, found, puzzle, checkAndFinish])

  const tryInput = async () => {
    const word = input.toUpperCase().trim()
    setInput('')
    if (!word) return
    if (puzzle.words.includes(word) && !found.includes(word)) {
      const nf = [...found, word]
      setFound(nf)
      setTotalPts(p => p+1)
      setMsg('✅ ' + word + '! +1 бал')
      await checkAndFinish(nf)
    } else {
      setMsg('❌ Не вірно')
    }
  }

  if (!started) return (
    <div className="text-center space-y-4 p-4">
      <div className="text-5xl">🧩</div>
      <h2 className="text-xl font-bold">Ворд-пазл</h2>
      <p className="text-sm text-gray-500">Знайди приховані кавові слова в сітці</p>
      <p className="text-xs text-gray-400">1 бал за слово · Max 5 балів/день</p>
      <button onClick={()=>setStarted(true)} className="w-full py-3 rounded-2xl bg-amber-700 text-white font-medium">Почати</button>
    </div>
  )

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap gap-2 mb-2">
        {puzzle.words.map(w => (
          <span key={w} className={`px-3 py-1 rounded-full text-sm font-medium ${found.includes(w) ? 'bg-green-100 text-green-700 line-through' : 'bg-gray-100 text-gray-500'}`}>{w}</span>
        ))}
      </div>
      <div className="grid gap-1" style={{gridTemplateColumns: `repeat(${puzzle.size}, 1fr)`}}>
        {puzzle.grid.map((letter, i) => (
          <button key={i} onClick={() => toggleCell(i)}
            className={`h-10 rounded-lg text-sm font-bold transition-all ${
              selected.includes(i) ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-amber-100'
            }`}>
            {letter}
          </button>
        ))}
      </div>
      <button onClick={check} disabled={selected.length < 2 || done}
        className="w-full py-2 rounded-xl bg-amber-700 text-white disabled:opacity-50">
        Перевірити вибір
      </button>
      <div className="flex gap-2">
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&tryInput()}
          placeholder="Або введи слово..." className="flex-1 border rounded-xl px-3 py-2 text-sm bg-white" />
        <button onClick={tryInput} className="px-4 rounded-xl bg-amber-500 text-white text-sm">OK</button>
      </div>
      {msg && <p className="text-center text-sm font-medium text-amber-700">{msg}</p>}
      {done && <p className="text-center text-green-600 font-bold">+{totalPts} балів нараховано!</p>}
    </div>
  )
}
