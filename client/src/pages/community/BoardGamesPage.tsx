import { FormEvent, useEffect, useState } from 'react'
import { communityApi, locationsApi } from '../../lib/api'

export default function BoardGamesPage() {
  const [games, setGames] = useState<any[]>([])
  const [meetups, setMeetups] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [form, setForm] = useState({ title: '', gameId: '', locationId: '', startsAt: '', maxPlayers: 4, description: '' })

  const load = async () => {
    const [g, m, l] = await Promise.all([
      communityApi.getBoardGames(),
      communityApi.getMeetups({ status: 'OPEN' }),
      locationsApi.getAll(),
    ])
    setGames(g.data.games || [])
    setMeetups(m.data.meetups || [])
    setLocations((l.data.locations || []).filter((x: any) => x.isActive !== false))
  }

  useEffect(() => { load() }, [])

  const createMeetup = async (e: FormEvent) => {
    e.preventDefault()
    await communityApi.createMeetup({
      title: form.title,
      gameId: form.gameId || undefined,
      locationId: form.locationId ? Number(form.locationId) : undefined,
      startsAt: new Date(form.startsAt).toISOString(),
      maxPlayers: form.maxPlayers,
      description: form.description || undefined,
    })
    setForm({ title: '', gameId: '', locationId: '', startsAt: '', maxPlayers: 4, description: '' })
    await load()
  }

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-lg font-bold text-coffee-800">Настільні ігри</h1>

      <form onSubmit={createMeetup} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
        <div className="font-semibold text-sm">Створити зустріч</div>
        <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Шукаю 3 людей на Catan у п’ятницю" value={form.title} onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))} maxLength={100} required />
        <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.gameId} onChange={(e) => setForm((v) => ({ ...v, gameId: e.target.value }))}>
          <option value="">Оберіть гру</option>
          {games.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
        <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.locationId} onChange={(e) => setForm((v) => ({ ...v, locationId: e.target.value }))}>
          <option value="">Оберіть локацію</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <input type="datetime-local" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.startsAt} onChange={(e) => setForm((v) => ({ ...v, startsAt: e.target.value }))} required />
        <input type="number" min={2} max={12} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" value={form.maxPlayers} onChange={(e) => setForm((v) => ({ ...v, maxPlayers: Number(e.target.value) }))} />
        <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={2} maxLength={500} value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} placeholder="Опис" />
        <button type="submit" className="w-full py-2 rounded-lg bg-coffee-600 text-white text-sm font-semibold">Створити</button>
      </form>

      <div className="space-y-2">
        {meetups.map((m) => (
          <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-3">
            <div className="font-semibold">{m.title}</div>
            <div className="text-xs text-gray-500">{m.game?.title || 'Без гри'} · {m.location?.name || 'Локація не вказана'}</div>
            <div className="text-xs text-gray-500">{new Date(m.startsAt).toLocaleString()} · {m.participantsCount}/{m.maxPlayers}</div>
            <div className="mt-2 flex gap-2">
              {!m.isJoined ? (
                <button type="button" onClick={async () => { await communityApi.joinMeetup(m.id); await load() }} className="px-3 py-1.5 rounded-lg bg-coffee-600 text-white text-xs">Приєднатись</button>
              ) : (
                <button type="button" onClick={async () => { await communityApi.leaveMeetup(m.id); await load() }} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs">Покинути</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
