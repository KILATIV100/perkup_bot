import { useState, useEffect, useRef } from 'react'
import { radioApi } from '../lib/api'

interface RadioTrack {
  id: number
  title: string
  artist: string
  url: string
  duration: number
  genre: string
}

const GENRES = [
  { id: 'all',   label: 'Усі' },
  { id: 'lofi',  label: 'Lo-fi' },
  { id: 'jazz',  label: 'Jazz' },
  { id: 'indie', label: 'Indie' },
]

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m + ':' + s.toString().padStart(2, '0')
}

export default function RadioPage() {
  const [currentTrack, setCurrentTrack] = useState<RadioTrack | null>(null)
  const [position, setPosition] = useState(0)
  const [playlist, setPlaylist] = useState<RadioTrack[]>([])
  const [selectedGenre, setSelectedGenre] = useState('all')
  const [genreSaved, setGenreSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pulse, setPulse] = useState(false)
  const positionRef = useRef(position)
  positionRef.current = position

  const loadNow = async () => {
    try {
      const res = await radioApi.now()
      const d = res.data
      if (d.currentTrack) {
        setCurrentTrack(d.currentTrack)
        setPosition(d.position)
      }
    } catch { /* no tracks */ }
  }

  const loadPlaylist = async () => {
    try {
      const res = await radioApi.playlist()
      setPlaylist(res.data.tracks || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    loadNow()
    loadPlaylist()

    // Re-sync every 30s
    const syncInterval = setInterval(loadNow, 30000)
    // Advance local position every second
    const tickInterval = setInterval(() => {
      setPosition(p => {
        const dur = currentTrack?.duration ?? 0
        if (dur > 0 && p >= dur - 1) { loadNow(); return 0 }
        return p + 1
      })
    }, 1000)
    // Pulse animation
    const pulseInterval = setInterval(() => setPulse(v => !v), 800)

    return () => {
      clearInterval(syncInterval)
      clearInterval(tickInterval)
      clearInterval(pulseInterval)
    }
  }, [])

  const handleGenreSelect = async (genre: string) => {
    setSelectedGenre(genre)
    setGenreSaved(false)
    try {
      await radioApi.setGenre(genre)
      setGenreSaved(true)
      setTimeout(() => setGenreSaved(false), 2000)
    } catch { /* ignore */ }
  }

  const filteredPlaylist = selectedGenre === 'all'
    ? playlist
    : playlist.filter(t => t.genre === selectedGenre)

  const progressPct = currentTrack && currentTrack.duration > 0
    ? Math.min(100, Math.round((position / currentTrack.duration) * 100))
    : 0

  return (
    <div className="pb-24">
      {/* Hero - Now Playing */}
      <div className="bg-gradient-to-br from-coffee-800 to-coffee-950 px-6 py-8 text-white">
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full bg-white/10 animate-pulse" />
            <div className="h-4 w-40 bg-white/20 rounded animate-pulse" />
          </div>
        ) : currentTrack ? (
          <div className="flex flex-col items-center">
            {/* Animated disc */}
            <div className="relative mb-5">
              <div
                className="w-36 h-36 rounded-full shadow-2xl flex items-center justify-center text-5xl"
                style={{
                  background: 'conic-gradient(#7c3aed, #2563eb, #059669, #d97706, #7c3aed)',
                  animation: 'spin 8s linear infinite',
                }}
              >
                <div className="w-14 h-14 rounded-full bg-coffee-900 flex items-center justify-center text-2xl">
                  ☕
                </div>
              </div>
              {/* Pulsing ring */}
              <div
                className="absolute inset-0 rounded-full border-2 border-white/30 transition-all duration-700"
                style={{
                  transform: pulse ? 'scale(1.12)' : 'scale(1)',
                  opacity: pulse ? 0.5 : 0.2,
                }}
              />
            </div>

            <div className="text-center mb-5">
              <div className="text-xl font-bold">{currentTrack.title}</div>
              <div className="text-sm text-white/70 mt-0.5">{currentTrack.artist}</div>
              <div className="text-xs text-white/50 mt-1 uppercase tracking-wider">{currentTrack.genre}</div>
            </div>

            {/* Progress bar */}
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-xs text-white/60 mb-1">
                <span>{formatTime(position)}</span>
                <span>{formatTime(currentTrack.duration)}</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-1000"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-white/50">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-white/60"
                  style={{
                    height: `${6 + Math.sin(Date.now() / 300 + i) * 4}px`,
                    animation: `soundbar 0.${5 + i}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
              <span className="ml-1">Синхронізовано</span>
            </div>
          </div>
        ) : (
          <div className="text-center text-white/60 py-8">
            <div className="text-4xl mb-3">🎵</div>
            <div>Немає активних треків</div>
          </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Genre picker */}
        <div>
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">
            Жанр {genreSaved && <span className="text-green-500 normal-case font-normal">✓ Збережено</span>}
          </div>
          <div className="flex gap-2 flex-wrap">
            {GENRES.map(g => (
              <button
                key={g.id}
                onClick={() => handleGenreSelect(g.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  selectedGenre === g.id
                    ? 'bg-coffee-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Playlist */}
        <div>
          <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Плейлист</div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : filteredPlaylist.length === 0 ? (
            <div className="text-gray-400 text-sm py-4 text-center">Треків немає</div>
          ) : (
            <div className="space-y-2">
              {filteredPlaylist.map((t, idx) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    currentTrack?.id === t.id
                      ? 'bg-coffee-50 border border-coffee-200'
                      : 'bg-white border border-gray-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    currentTrack?.id === t.id ? 'bg-coffee-600 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {currentTrack?.id === t.id ? '♪' : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="text-xs text-gray-400 truncate">{t.artist} • {t.genre}</div>
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0">{formatTime(t.duration)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes soundbar { from { transform: scaleY(0.5); } to { transform: scaleY(1.5); } }
      `}</style>
    </div>
  )
}
