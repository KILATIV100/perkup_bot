import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { communityApi } from '../../lib/api'

export default function MovieNightsPage() {
  const [events, setEvents] = useState<any[]>([])

  const load = async () => {
    const res = await communityApi.getEvents({ type: 'MOVIE_NIGHT', upcoming: true })
    setEvents(res.data.events || [])
  }

  useEffect(() => { load() }, [])

  return (
    <div className="p-4 pb-24 space-y-3">
      <h1 className="text-lg font-bold text-coffee-800">Кіновечори PerkUp</h1>
      {events.map((e) => (
        <Link key={e.id} to={`/community/events/${e.id}`} className="block bg-white rounded-xl border border-gray-100 p-4">
          <div className="font-semibold">{e.title}</div>
          <div className="text-xs text-gray-500">{e.location?.name || 'Локація не вказана'} · {new Date(e.startsAt).toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Учасників: {e.participantsCount}{e.capacity ? `/${e.capacity}` : ''}</div>
        </Link>
      ))}
      {events.length === 0 && <div className="text-sm text-gray-500">Поки немає анонсованих кіновечорів.</div>}
    </div>
  )
}
