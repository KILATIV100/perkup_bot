import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { communityApi } from '../../lib/api'

export default function CommunityEventDetailsPage() {
  const { id = '' } = useParams()
  const [event, setEvent] = useState<any>(null)

  const load = async () => {
    const res = await communityApi.getEventById(id)
    setEvent(res.data.event)
  }

  useEffect(() => { if (id) load() }, [id])

  if (!event) return <div className="p-4">Завантаження...</div>

  return (
    <div className="p-4 pb-24 space-y-3">
      <h1 className="text-lg font-bold text-coffee-800">{event.title}</h1>
      <div className="text-sm text-gray-600">{event.description || 'Без опису'}</div>
      <div className="text-xs text-gray-500">{event.location?.name || 'Локація не вказана'} · {new Date(event.startsAt).toLocaleString()}</div>

      <div className="flex gap-2">
        {!event.isJoined ? (
          <button className="px-4 py-2 rounded-lg bg-coffee-600 text-white text-sm" onClick={async () => { await communityApi.joinEvent(event.id); await load() }}>Я піду</button>
        ) : (
          <button className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm" onClick={async () => { await communityApi.leaveEvent(event.id); await load() }}>Не піду</button>
        )}
      </div>

      {event.type === 'MOVIE_NIGHT' && (
        <div className="bg-white rounded-xl border border-gray-100 p-3 space-y-2">
          <div className="font-semibold text-sm">Голосування за фільм</div>
          {event.movieOptions.map((opt: any) => (
            <button key={opt.id} className={`w-full text-left border rounded-lg px-3 py-2 text-sm ${opt.isVotedByMe ? 'border-coffee-500 bg-coffee-50' : 'border-gray-200'}`} onClick={async () => { await communityApi.voteMovie(event.id, opt.id); await load() }}>
              {opt.title} — {opt.votesCount} голосів
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
