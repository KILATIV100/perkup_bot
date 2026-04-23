import { useState, useCallback } from 'react'
import { gameApi } from '../lib/api'

type Cell = 'X' | 'O' | null
type Mode = 'menu' | 'playing' | 'result'

const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]

function checkWinner(board: Cell[]): Cell | 'draw' | null {
  for (const [a,b,c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[b] === board[c]) return board[a]
  }
  if (board.every(c => c !== null)) return 'draw'
  return null
}

function aiMove(board: Cell[]): number {
  // 1. AI виграє
  for (const [a,b,c] of WIN_LINES) {
    if (board[a]==='O' && board[b]==='O' && board[c]===null) return c
    if (board[a]==='O' && board[c]==='O' && board[b]===null) return b
    if (board[b]==='O' && board[c]==='O' && board[a]===null) return a
  }
  // 2. Блокуємо гравця
  for (const [a,b,c] of WIN_LINES) {
    if (board[a]==='X' && board[b]==='X' && board[c]===null) return c
    if (board[a]==='X' && board[c]==='X' && board[b]===null) return b
    if (board[b]==='X' && board[c]==='X' && board[a]===null) return a
  }
  // 3. Центр
  if (board[4] === null) return 4
  // 4. Кут
  const corners = [0,2,6,8].filter(i => board[i]===null)
  if (corners.length) return corners[Math.floor(Math.random()*corners.length)]
  // 5. Будь-яке вільне
  const empty = board.map((c,i) => c===null ? i : -1).filter(i => i>=0)
  return empty[Math.floor(Math.random()*empty.length)]
}

interface Props { onFinish: (pts: number) => void }

export default function TicTacToe({ onFinish }: Props) {
  const [mode, setMode] = useState<Mode>('menu')
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null))
  const [isX, setIsX] = useState(true)
  const [result, setResult] = useState<'win'|'draw'|'lose'|null>(null)
  const [pts, setPts] = useState(0)
  const [loading, setLoading] = useState(false)
  const [winLine, setWinLine] = useState<number[]>([])
  const [aiThinking, setAiThinking] = useState(false)

  const startGame = () => {
    setBoard(Array(9).fill(null))
    setIsX(true); setResult(null); setWinLine([])
    setAiThinking(false); setLoading(false)
    setMode('playing')
  }

  const endGame = useCallback(async (r: 'win'|'draw'|'lose') => {
    setResult(r)
    setLoading(true)
    const score = r === 'win' ? 1 : r === 'draw' ? 0.5 : 0
    try {
      const res = await gameApi.finishGame('TIC_TAC_TOE', score)
      const earned = res.data?.pointsWon || res.data?.earnedPoints || 0
      setPts(earned)
    } catch { setPts(0) }
    setLoading(false)
    setMode('result')
  }, [])

  const click = useCallback((i: number) => {
    if (!isX || board[i] || result || mode !== 'playing' || aiThinking) return

    const nb = [...board]; nb[i] = 'X'
    const w = checkWinner(nb)
    setBoard(nb)

    if (w) {
      const wl = w !== 'draw' ? (WIN_LINES.find(([a,b,c]) => nb[a]===w && nb[b]===w && nb[c]===w) || []) : []
      setWinLine(wl); endGame(w === 'X' ? 'win' : w === 'draw' ? 'draw' : 'lose'); return
    }

    setIsX(false); setAiThinking(true)
    setTimeout(() => {
      const ai = aiMove(nb)
      const nb2 = [...nb]; nb2[ai] = 'O'
      const w2 = checkWinner(nb2)
      setBoard(nb2); setAiThinking(false)
      if (w2) {
        const wl2 = w2 !== 'draw' ? (WIN_LINES.find(([a,b,c]) => nb2[a]===w2 && nb2[b]===w2 && nb2[c]===w2) || []) : []
        setWinLine(wl2); endGame(w2 === 'O' ? 'lose' : 'draw')
      } else {
        setIsX(true)
      }
    }, 500)
  }, [board, isX, result, mode, aiThinking, endGame])

  // ── Menu ──
  if (mode === 'menu') return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-5">
      <div className="w-24 h-24 bg-amber-50 rounded-3xl flex items-center justify-center text-5xl shadow-sm border border-amber-100">
        ❌
      </div>
      <div>
        <h2 className="text-2xl font-bold text-stone-800">Хрестики-нулики</h2>
        <p className="text-stone-400 text-sm mt-1">Переможи AI і заробляй бали</p>
      </div>
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 w-full max-w-xs text-sm space-y-1">
        <div className="flex justify-between"><span className="text-stone-500">🏆 Перемога</span><span className="font-semibold text-amber-800">5 балів</span></div>
        <div className="flex justify-between"><span className="text-stone-500">🤝 Нічия</span><span className="font-semibold text-amber-800">2 бали</span></div>
        <div className="flex justify-between"><span className="text-stone-500">😢 Поразка</span><span className="font-semibold text-stone-400">0 балів</span></div>
        <div className="flex justify-between border-t border-amber-100 pt-1 mt-1"><span className="text-stone-500">⏱ Cooldown</span><span className="font-semibold text-stone-500">4 год</span></div>
      </div>
      <button onClick={startGame} className="w-full max-w-xs py-4 rounded-2xl bg-amber-800 text-white font-semibold text-lg shadow-md active:scale-95 transition-transform">
        Грати vs AI
      </button>
    </div>
  )

  // ── Result ──
  if (mode === 'result') return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center gap-5">
      <div className="text-7xl">{result === 'win' ? '🏆' : result === 'draw' ? '🤝' : '😢'}</div>
      <div>
        <h2 className="text-2xl font-bold text-stone-800">
          {result === 'win' ? 'Перемога!' : result === 'draw' ? 'Нічия!' : 'Поразка!'}
        </h2>
        <p className="text-stone-400 text-sm mt-1">
          {result === 'win' ? 'Ти переміг AI!' : result === 'draw' ? 'Нічия — непогано!' : 'AI виявився сильнішим'}
        </p>
      </div>
      {loading
        ? <div className="text-stone-400 text-sm animate-pulse">Зберігаємо результат...</div>
        : pts > 0
          ? <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-3 text-green-700 font-bold text-xl">+{pts} балів!</div>
          : <div className="bg-stone-50 border border-stone-200 rounded-2xl px-6 py-3 text-stone-500 text-sm">Балів не нараховано</div>
      }
      <div className="flex gap-3 w-full max-w-xs">
        <button onClick={startGame} className="flex-1 py-3 rounded-2xl bg-amber-800 text-white font-semibold active:scale-95 transition-transform">
          Ще раз
        </button>
      </div>
    </div>
  )

  // ── Board ──
  return (
    <div className="p-4">
      {/* Status bar */}
      <div className="flex items-center justify-center mb-5 gap-2">
        <div className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
          isX && !aiThinking ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-400'
        }`}>Ти ❌</div>
        <div className="text-stone-300 text-xs">vs</div>
        <div className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
          aiThinking ? 'bg-stone-700 text-white animate-pulse' : 'bg-stone-100 text-stone-400'
        }`}>{aiThinking ? 'AI думає...' : 'AI ⭕'}</div>
      </div>

      {/* Board */}
      <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => click(i)}
            disabled={!!cell || !isX || aiThinking}
            className={`aspect-square rounded-2xl text-4xl font-bold border-2 transition-all duration-200 ${
              winLine.includes(i)
                ? 'border-green-400 bg-green-50 scale-105'
                : cell
                  ? 'border-stone-200 bg-stone-50'
                  : 'border-stone-200 bg-white hover:bg-amber-50 hover:border-amber-300 active:scale-95'
            }`}
          >
            {cell === 'X' ? '❌' : cell === 'O' ? '⭕' : ''}
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-stone-400 mt-4">
        {aiThinking ? '⏳ Чекай...' : isX ? 'Натисни на клітинку' : ''}
      </p>
    </div>
  )
}
