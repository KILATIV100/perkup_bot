import { useState, useCallback, useRef } from 'react'
import { gameApi } from '../lib/api'

interface WordSet { words: string[]; hints: string[] }

const FALLBACK_SETS: WordSet[] = [
  { words: ['КАВА','ЛАТЕ','КРЕМА','ЗЕРНО','АРОМАТ'], hints: ['Улюблений напій ☕','Кава з молоком 🥛','Пінка на еспресо ✨','З чого варять каву 🫘','Запах кави 🌿'] },
  { words: ['ЕСПРЕСО','БАРИСТА','МОККО','КАПУЧІНО','АМЕРИКАНО'], hints: ['Основа всіх напоїв','Майстер кави','Кава з шоколадом','З молочною піною','Розбавлений водою'] },
  { words: ['ПЕРКАП','БОНУС','РІВЕНЬ','БАЛИ','СПІН'], hints: ['Наш додаток ☕','Нагорода за замовлення','Bronze Silver Gold','Накопичуєш їх','Колесо фортуни 🎡'] },
  { words: ['АЕРОП','ПУРОВЕ','КЕМЕКС','ДРИП','КЛЕВЕР'], hints: ['Пристрій для заварювання','Метод фільтр-кави','Колба-лійка','Крапельне заварювання','Спеціальний прес-метод'] },
]

async function generateAIWordSet(): Promise<WordSet | null> {
  try {
    const themes = ['кавові напої','кавове обладнання','кавові терміни','PerkUp бонусна програма','країни-виробники кави']
    const theme = themes[Math.floor(Math.random() * themes.length)]

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: 'Ти генеруєш слова для гри в слова для Telegram Mini App PerkUp. Відповідай ТІЛЬКИ валідним JSON без markdown. Мова: українська. Слова — ВЕЛИКИМИ ЛІТЕРАМИ.',
        messages: [{
          role: 'user',
          content: `Тема: "${theme}". Згенеруй 5 слів і підказки до них.
JSON (без коментарів):
{"words":["СЛОВО1","СЛОВО2","СЛОВО3","СЛОВО4","СЛОВО5"],"hints":["підказка1","підказка2","підказка3","підказка4","підказка5"]}
Правила: слова 4–8 літер, мають стосуватись кави/PerkUp, підказки короткі (3–5 слів).`
        }],
      }),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    const text = data.content?.[0]?.text?.trim() || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed.words) || parsed.words.length < 3) return null
    return { words: parsed.words.map((w: string) => w.toUpperCase()), hints: parsed.hints }
  } catch { return null }
}

interface Props { onFinish: (pts: number) => void }

export default function WordPuzzle({ onFinish }: Props) {
  const [phase, setPhase] = useState<'menu'|'loading'|'playing'|'result'>('menu')
  const [wordSet, setWordSet] = useState<WordSet | null>(null)
  const [isAI, setIsAI] = useState(false)
  const [found, setFound] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [msg, setMsg] = useState<{text:string; ok:boolean}|null>(null)
  const [pts, setPts] = useState(0)
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const msgTimer = useRef<ReturnType<typeof setTimeout>>()

  const showMsg = (text: string, ok: boolean) => {
    clearTimeout(msgTimer.current)
    setMsg({text, ok})
    msgTimer.current = setTimeout(() => setMsg(null), 2000)
  }

  const loadGame = async () => {
    setPhase('loading')
    setFound([]); setPts(0); setInput('')

    const ai = await generateAIWordSet()
    if (ai) { setWordSet(ai); setIsAI(true) }
    else {
      const fb = FALLBACK_SETS[Math.floor(Math.random() * FALLBACK_SETS.length)]
      setWordSet(fb); setIsAI(false)
    }
    setPhase('playing')
    setTimeout(() => inputRef.current?.focus(), 300)
  }

  const finish = useCallback(async (foundWords: string[]) => {
    setLoading(true)
    try {
      const res = await gameApi.finishGame('WORD_PUZZLE', foundWords.length)
      const earned = res.data?.pointsWon || res.data?.earnedPoints || 0
      setPts(earned); onFinish(earned)
    } catch { onFinish(0) }
    setLoading(false)
    setPhase('result')
  }, [onFinish])

  const check = useCallback(async () => {
    if (!wordSet) return
    const word = input.trim().toUpperCase().replace(/\s+/g,'')
    setInput(''); inputRef.current?.focus()
    if (!word) return

    if (found.includes(word)) { showMsg('Вже знайдено!', false); return }

    if (wordSet.words.includes(word)) {
      const nf = [...found, word]
      setFound(nf)
      showMsg(`✅ «${word}» +1 бал`, true)
      if (nf.length >= wordSet.words.length) { await finish(nf) }
    } else {
      setShake(true); setTimeout(() => setShake(false), 400)
      showMsg(`❌ «${word}» не знайдено`, false)
    }
  }, [input, found, wordSet, finish])

  // ── Menu ──
  if (phase === 'menu') return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-5">
      <div className="w-24 h-24 bg-amber-50 rounded-3xl flex items-center justify-center text-5xl shadow-sm border border-amber-100">🧩</div>
      <div>
        <h2 className="text-2xl font-bold text-stone-800">Кавові слова</h2>
        <p className="text-stone-400 text-sm mt-1">Відгадай слова за підказками від AI</p>
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 w-full max-w-xs text-sm space-y-1">
        <div className="flex justify-between"><span className="text-stone-500">🎯 За кожне слово</span><span className="font-semibold text-amber-800">1 бал</span></div>
        <div className="flex justify-between"><span className="text-stone-500">🏆 Всі слова</span><span className="font-semibold text-amber-800">до 5 балів</span></div>
        <div className="flex justify-between"><span className="text-stone-500">🤖 Генерація</span><span className="font-semibold text-stone-500">AI / база</span></div>
        <div className="flex justify-between border-t border-amber-100 pt-1 mt-1"><span className="text-stone-500">⏱ Cooldown</span><span className="font-semibold text-stone-500">4 год</span></div>
      </div>
      <button onClick={loadGame} className="w-full max-w-xs py-4 rounded-2xl bg-amber-800 text-white font-semibold text-lg shadow-md active:scale-95 transition-transform">Почати</button>
    </div>
  )

  // ── Loading ──
  if (phase === 'loading') return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-4">
      <div className="text-5xl animate-spin">☕</div>
      <p className="text-stone-600 font-medium">AI підбирає слова...</p>
    </div>
  )

  // ── Result ──
  if (phase === 'result') return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-5">
      <div className="text-7xl">{found.length === wordSet?.words.length ? '🏆' : '👍'}</div>
      <div>
        <h2 className="text-2xl font-bold text-stone-800">
          {found.length === wordSet?.words.length ? 'Всі слова!' : `${found.length} з ${wordSet?.words.length}`}
        </h2>
        <div className="flex flex-wrap gap-2 justify-center mt-3">
          {wordSet?.words.map(w => (
            <span key={w} className={`px-3 py-1 rounded-full text-sm font-medium ${found.includes(w) ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-400 line-through'}`}>{w}</span>
          ))}
        </div>
      </div>
      {loading
        ? <div className="text-stone-400 text-sm animate-pulse">Зберігаємо...</div>
        : pts > 0
          ? <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-3 text-green-700 font-bold text-xl">+{pts} балів!</div>
          : <div className="bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 text-stone-500 text-sm">Спробуй ще!</div>
      }
      <div className="flex gap-3 w-full max-w-xs">
        <button onClick={loadGame} className="flex-1 py-3 rounded-2xl bg-amber-800 text-white font-semibold active:scale-95 transition-transform">Ще раз</button>
        <button onClick={() => onFinish(pts)} className="flex-1 py-3 rounded-2xl bg-stone-100 text-stone-700 font-semibold active:scale-95 transition-transform">До ігор</button>
      </div>
    </div>
  )

  // ── Playing ──
  const ws = wordSet!
  const remaining = ws.words.length - found.length
  return (
    <div className="p-4 space-y-4">
      {isAI && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          <span>🤖</span><span>Слова згенеровані AI</span>
        </div>
      )}

      {/* Progress */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-500">Знайдено {found.length}/{ws.words.length}</span>
        <div className="flex gap-1">
          {ws.words.map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full transition-all ${i < found.length ? 'bg-green-500' : 'bg-stone-200'}`} />
          ))}
        </div>
      </div>

      {/* Hints */}
      <div className="space-y-2">
        {ws.words.map((word, i) => {
          const solved = found.includes(word)
          return (
            <div key={word} className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all ${solved ? 'border-green-200 bg-green-50' : 'border-stone-100 bg-white'}`}>
              <span className="text-lg shrink-0">{solved ? '✅' : `${i+1}.`}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${solved ? 'text-stone-400' : 'text-stone-700'}`}>{ws.hints[i]}</p>
                {solved && <p className="text-xs font-bold text-green-700 mt-0.5">{word}</p>}
              </div>
              {!solved && (
                <p className="text-xs text-stone-300 font-mono shrink-0">{'_ '.repeat(word.length).trim()}</p>
              )}
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div className={`flex gap-2 ${shake ? 'animate-[shake_0.35s_ease]' : ''}`}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && check()}
          placeholder={`${remaining} слів залишилось...`}
          className="flex-1 border-2 border-stone-200 rounded-2xl px-4 py-3 text-sm bg-white focus:border-amber-400 focus:outline-none transition-colors uppercase"
          autoCapitalize="characters"
        />
        <button onClick={check} disabled={!input.trim()} className="px-5 rounded-2xl bg-amber-800 text-white text-sm font-semibold disabled:opacity-40 active:scale-95 transition-all">
          OK
        </button>
      </div>

      {msg && (
        <div className={`text-center py-2 px-4 rounded-xl text-sm font-medium ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {msg.text}
        </div>
      )}

      {found.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {found.map(w => <span key={w} className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">{w} ✓</span>)}
        </div>
      )}
    </div>
  )
}
