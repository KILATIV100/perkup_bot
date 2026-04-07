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

interface NowResponse {
  currentTrack: RadioTrack | null
  position: number
  serverTime: number
}

export default function RadioPlayer() {
  const [track, setTrack] = useState<RadioTrack | null>(null)
  const [playing, setPlaying] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    radioApi.now()
      .then(r => {
        const data = r.data as NowResponse
        if (data.currentTrack) {
          setTrack(data.currentTrack)
          setVisible(true)
        }
      })
      .catch(() => { /* no tracks available */ })
  }, [])

  const syncAudio = async () => {
    try {
      const r = await radioApi.now()
      const data = r.data as NowResponse
      if (!data.currentTrack) return

      const audio = audioRef.current
      if (!audio) return

      if (data.currentTrack.id !== track?.id) {
        setTrack(data.currentTrack)
        audio.src = data.currentTrack.url
        audio.currentTime = data.position
        if (playing) audio.play().catch(() => {})
      } else {
        const drift = Math.abs(audio.currentTime - data.position)
        if (drift > 3) {
          audio.currentTime = data.position
        }
      }
    } catch { /* ignore */ }
  }

  const handlePlay = async () => {
    if (!track) return
    const audio = audioRef.current
    if (!audio) return

    if (!audio.src || audio.src === window.location.href) {
      const r = await radioApi.now()
      const data = r.data as NowResponse
      audio.src = track.url
      audio.currentTime = data.position
    }

    try {
      await audio.play()
      setPlaying(true)
      syncIntervalRef.current = setInterval(syncAudio, 30000)
    } catch { /* autoplay blocked */ }
  }

  const handlePause = () => {
    audioRef.current?.pause()
    setPlaying(false)
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current)
      syncIntervalRef.current = null
    }
  }

  const handleToggle = () => {
    if (playing) handlePause()
    else handlePlay()
  }

  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
    }
  }, [])

  if (!visible || !track) return null

  return (
    <>
      <audio ref={audioRef} preload="none" />

      {/* Floating mini player */}
      <div
        className="fixed bottom-20 right-4 z-50"
        style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}
      >
        {expanded ? (
          <div className="bg-white rounded-2xl p-4 w-64 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-gray-400 font-medium">PerkUp Radio</span>
              <button
                onClick={() => setExpanded(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="mb-3">
              <div className="font-semibold text-gray-800 text-sm truncate">{track.title}</div>
              <div className="text-xs text-gray-400 truncate">{track.artist}</div>
            </div>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleToggle}
                className="w-10 h-10 rounded-full bg-coffee-600 text-white flex items-center justify-center text-lg"
              >
                {playing ? '⏸' : '▶'}
              </button>
            </div>
            {playing && (
              <div className="mt-3 flex items-center gap-1.5">
                {[0, 1, 2, 3].map(i => (
                  <div
                    key={i}
                    className="w-1 bg-coffee-400 rounded-full animate-pulse"
                    style={{
                      height: `${8 + (i % 3) * 4}px`,
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
                <span className="text-xs text-gray-400 ml-1">Грає зараз</span>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => setExpanded(true)}
            className="w-12 h-12 rounded-full bg-coffee-600 text-white flex items-center justify-center shadow-lg text-xl"
            title="PerkUp Radio"
          >
            {playing ? '\uD83C\uDFB5' : '\uD83C\uDFB6'}
          </button>
        )}
      </div>
    </>
  )
}
