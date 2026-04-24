import { FormEvent, useEffect, useMemo, useState } from 'react'
import { communityApi } from '../../lib/api'

type Channel = 'GENERAL' | 'BOARD_GAMES' | 'MOVIE_NIGHTS'

const CHANNELS: Array<{ key: Channel; label: string }> = [
  { key: 'GENERAL', label: 'Загальний' },
  { key: 'BOARD_GAMES', label: 'Настільні ігри' },
  { key: 'MOVIE_NIGHTS', label: 'Кіновечори' },
]

export default function CommunityChatPage() {
  const [channel, setChannel] = useState<Channel>('GENERAL')
  const [messages, setMessages] = useState<any[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  const lastCreatedAt = useMemo(() => messages[messages.length - 1]?.createdAt, [messages])

  const loadMessages = async (incremental = false) => {
    try {
      const res = await communityApi.getChatMessages({ channel, limit: 100, after: incremental ? lastCreatedAt : undefined })
      const next = res.data.messages || []
      setMessages((prev) => (incremental ? [...prev, ...next] : next))
    } catch {
      if (!incremental) setMessages([])
    }
  }

  useEffect(() => {
    setMessages([])
    loadMessages(false)
  }, [channel])

  useEffect(() => {
    const id = setInterval(() => loadMessages(true), 5000)
    return () => clearInterval(id)
  }, [channel, lastCreatedAt])

  const onSend = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    setLoading(true)
    try {
      await communityApi.postChatMessage({ channel, text: trimmed })
      setText('')
      await loadMessages(true)
    } finally {
      setLoading(false)
    }
  }

  const onDelete = async (id: string) => {
    await communityApi.deleteChatMessage(id)
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  return (
    <div className="p-4 pb-24 h-full flex flex-col gap-3">
      <h1 className="text-lg font-bold text-coffee-800">Клуб PerkUp · Чат</h1>

      <div className="flex gap-2 overflow-x-auto">
        {CHANNELS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setChannel(tab.key)}
            className={`px-3 py-2 text-sm rounded-full border whitespace-nowrap ${channel === tab.key ? 'bg-coffee-600 text-white border-coffee-600' : 'bg-white text-coffee-700 border-gray-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-white rounded-xl border border-gray-100 p-3 space-y-2 overflow-y-auto">
        {messages.map((m) => (
          <div key={m.id} className="border-b border-gray-50 pb-2">
            <div className="text-xs text-gray-500 flex justify-between">
              <span className="font-semibold text-gray-700">{m.user?.displayName}</span>
              <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
            </div>
            <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">{m.text}</div>
            {m.isMine && (
              <button type="button" className="text-xs text-red-500 mt-1" onClick={() => onDelete(m.id)}>Видалити</button>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={onSend} className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          placeholder="Написати повідомлення..."
          className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm"
          maxLength={500}
        />
        <button type="submit" disabled={loading} className="px-4 py-2 rounded-xl bg-coffee-600 text-white text-sm font-semibold disabled:opacity-60">
          Надіслати
        </button>
      </form>
    </div>
  )
}
