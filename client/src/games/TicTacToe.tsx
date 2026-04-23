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
  for (const [a,b,c] of WIN_LINES) {
    if (board[a]==='O' && board[b]==='O' && board[c]===null) return c
    if (board[a]==='O' && board[c]==='O' && board[b]===null) return b
    if (board[b]==='O' && board[c]==='O' && board[a]===null) return a
  }
  for (const [a,b,c] of WIN_LINES) {
    if (board[a]==='X' && board[b]==='X' && board[c]===null) return c
    if (board[a]==='X' && board[c]==='X' && board[b]===null) return b
    if (board[b]==='X' && board[c]==='X' && board[a]===null) return a
  }
  if (board[4] === null) return 4
  const corners = [0,2,6,8].filter(i => board[i]===null)
  if (corners.length) return corners[Math.floor(Math.random()*corners.length)]
  const empty = board.map((c,i) => c===null ? i : -1).filter(i => i>=0)
  return empty[Math.floor(Math.random()*empty.length)]
}

interface Props { onFinish: (pts: number) => void }

export default function TicTacToe({ onFinish }: Props) {
  const [mode, setMode] = useState<Mode>('menu')
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null))
  const [isX, setIsX] = useState(true)
  const [winner, setWinner] = useState<Cell | 'draw' | null>(null)
  const [pts, setPts] = useState(0)
  const [loading, setLoading] = useState(false)
  const [winLine, setWinLine] = useState<number[]>([])

  const startGame = () => {
    setBoard(Array(9).fill(null))
    setIsX(true)
    setWinner(null)
    setWinLine([])
    setMode('playing')
  }

  const finishGame = useCallback(async (result: 'win'|'draw'|'lose') => {
    const score = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0
    setLoading(true)
    try {
      const res = await gameApi.finishGame('TIC_TAC_TOE', score)
      setPts(res.data?.pointsWon || 0)
    } catch {}
    setLoading(false)
    setMode('result')
    onFinish(result === 'win' ? 5 : result === 'draw' ? 2 : 0)
  }, [onFinish])

  const click = useCallback((i: number) => {
    if (!isX || board[i] || winner || mode !== 'playing') return
    const nb = [...board]
    nb[i] = 'X'
    const w = checkWinner(nb)
    setBoard(nb)
    if (w) {
      const wl = w !== 'draw' ? WIN_LINES.find(([a,b,c]) => nb[a]===w && nb[b]===w && nb[c]===w) || [] : []
      setWinLine(wl)
      setWinner(w)
      finishGame(w === 'X' ? 'win' : w === 'draw' ? 'draw' : 'lose')
      return
    }
    setIsX(false)
    setTimeout(() => {
      const ai = aiMove(nb)
      const nb2 = [...nb]
      nb2[ai] = 'O'
      const w2 = checkWinner(nb2)
      setBoard(nb2)
      if (w2) {
        const wl2 = w2 !== 'draw' ? WIN_LINES.find(([a,b,c]) => nb2[a]===w2 && nb2[b]===w2 && nb2[c]===w2) || [] : []
        setWinLine(wl2)
        setWinner(w2)
        finishGame(w2 === 'X' ? 'win' : w2 === 'draw' ? 'draw' : 'lose')
      } else {
        setIsX(true)
      }
    }, 400)
  }, [board, isX, winner, mode, finishGame])

  if (mode === 'menu') return (
    <div className="text-center space-y-4 p-4">
      <div className="text-5xl mb-2">❌⭕</div>
      <h2 className="text-xl font-bold">Хрестики-нулики</h2>
      <p className="text-sm text-gray-500">Перемога: 5 балів · Нічия: 2 бали</p>
      <button onClick={startGame} className="w-full py-3 rounded-2xl bg-amber-700 text-white font-medium">Грати vs AI</button>
    </div>
  )

  if (mode === 'result') return (
    <div className="text-center space-y-4 p-4">
      <div className="text-5xl">{winner === 'X' ? '🏆' : winner === 'draw' ? '🤝' : '😢'}</div>
      <h2 className="text-xl font-bold">{winner === 'X' ? 'Перемога!' : winner === 'draw' ? 'Нічия!' : 'Поразка!'}</h2>
      {pts > 0 && <p className="text-green-600 font-medium">+{pts} балів нараховано!</p>}
      <button onClick={startGame} className="w-full py-3 rounded-2xl bg-amber-700 text-white">Ще раз</button>
    </div>
  )

  return (
    <div className="p-4">
      <div className="text-center mb-4 text-sm text-gray-500">{isX ? 'Твій хід ✏️' : 'AI думає...'}</div>
      <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
        {board.map((cell, i) => (
          <button key={i} onClick={() => click(i)}
            className={`h-24 rounded-2xl text-4xl font-bold border-2 transition-all ${
              winLine.includes(i) ? 'border-green-500 bg-green-50' :
              cell ? 'border-gray-300 bg-gray-50' : 'border-gray-200 bg-white hover:bg-amber-50'
            }`}>
            {cell === 'X' ? '❌' : cell === 'O' ? '⭕' : ''}
          </button>
        ))}
      </div>
      {loading && <p className="text-center mt-4 text-gray-400">Зберігаємо результат...</p>}
    </div>
  )
}
