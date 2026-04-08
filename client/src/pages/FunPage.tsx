import { useCallback, useEffect, useRef, useState } from 'react'
import CoffeeJumpGame from '../components/CoffeeJumpGame'
import { gameApi, radioApi } from '../lib/api'
import { useT } from '../lib/i18n'

interface LeaderEntry {
  rank: number
  userId: number
  name: string
  score: number
}

interface MyStats {
  bestScore: number
  rank: number | null
  playsToday: number
  playsLimit: number
  rewards: { score: number; points: number; claimed: boolean }[]
}

interface RadioTrack {
  id: number
  title: string
  artist: string
  url: string
  duration: number
  genre: string
}

type Tab = 'game' | 'leaderboard' | 'rewards' | 'radio'

export default function FunPage() {
  const [tab, setTab] = useState<Tab>('game')
  const [lastScore, setLastScore] = useState<number | null>(null)
  const [lastResult, setLastResult] = useState<{
    isNewRecord: boolean; bestScore: number; rank: number | null; earnedPoints: number
  } | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([])
  const [lbLoading, setLbLoading] = useState(false)
  const [stats, setStats] = useState<MyStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)

  // Radio state
  const [radioTrack, setRadioTrack] = useState<RadioTrack | null>(null)
  const [radioPlaying, setRadioPlaying] = useState(false)
  const [radioLoading, setRadioLoading] = useState(false)
  const tFn = useT()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const handleGameOver = useCallback(async (score: number) => {
    setLastScore(score)
    try {
      const res = await gameApi.submitScore(score)
      setLastResult(res.data)
    } catch {
      setLastResult(null)
    }
  }, [])

  const loadLeaderboard = useCallback(async () => {
    setLbLoading(true)
    try {
      const res = await gameApi.getLeaderboard()
      setLeaderboard(res.data.leaderboard || [])
    } catch { setLeaderboard([]) }
    finally { setLbLoading(false) }
  }, [])

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const res = await gameApi.getMyStats()
      setStats(res.data)
    } catch { setStats(null) }
    finally { setStatsLoading(false) }
  }, [])

  // Radio handlers
  const loadRadio = useCallback(async () => {
    setRadioLoading(true)
    try {
      const r = await radioApi.now()
      if (r.data.currentTrack) setRadioTrack(r.data.currentTrack)
    } catch { /* no tracks */ }
    finally { setRadioLoading(false) }
  }, [])

  const syncAudio = useCallback(async () => {
    try {
      const r = await radioApi.now()
      const data = r.data
      if (!data.currentTrack) return
      const audio = audioRef.current
      if (!audio) return
      if (data.currentTrack.id !== radioTrack?.id) {
        setRadioTrack(data.currentTrack)
        audio.src = data.currentTrack.url
        audio.currentTime = data.position
        if (radioPlaying) audio.play().catch(() => {})
      } else {
        const drift = Math.abs(audio.currentTime - data.position)
        if (drift > 3) audio.currentTime = data.position
      }
    } catch { /* ignore */ }
  }, [radioTrack, radioPlaying])

  const handleRadioToggle = async () => {
    const audio = audioRef.current
    if (!audio || !radioTrack) return
    if (radioPlaying) {
      audio.pause()
      setRadioPlaying(false)
      if (syncRef.current) { clearInterval(syncRef.current); syncRef.current = null }
    } else {
      if (!audio.src || audio.src === window.location.href) {
        const r = await radioApi.now()
        audio.src = radioTrack.url
        audio.currentTime = r.data.position
      }
      try {
        await audio.play()
        setRadioPlaying(true)
        syncRef.current = setInterval(syncAudio, 30000)
      } catch { /* autoplay blocked */ }
    }
  }

  useEffect(() => {
    if (tab === 'leaderboard') loadLeaderboard()
    if (tab === 'rewards') loadStats()
    if (tab === 'radio') loadRadio()
  }, [tab, loadLeaderboard, loadStats, loadRadio])

  useEffect(() => {
    return () => { if (syncRef.current) clearInterval(syncRef.current) }
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-100 bg-white sticky top-0 z-10">
        {([
          { key: 'game' as Tab, label: `🎮 ${tFn('fun.tab.game')}` },
          { key: 'radio' as Tab, label: `🎵 ${tFn('fun.tab.radio')}` },
          { key: 'leaderboard' as Tab, label: `🏆 ${tFn('fun.tab.top')}` },
          { key: 'rewards' as Tab, label: `🎁 ${tFn('fun.tab.rewards')}` },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              tab === t.key
                ? 'text-coffee-600 border-b-2 border-coffee-500'
                : 'text-gray-400'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Game Tab */}
      {tab === 'game' && (
        <div className="flex-1 flex flex-col p-3 pb-24 gap-3">
          {/* Score result banner */}
          {lastResult && lastScore !== null && (
            <div className={`p-3 rounded-xl text-center text-sm ${
              lastResult.isNewRecord
                ? 'bg-gradient-to-r from-amber-100 to-yellow-100 border border-amber-200'
                : 'bg-gray-50 border border-gray-100'
            }`}>
              {lastResult.isNewRecord && (
                <div className="text-amber-600 font-bold text-base mb-1">{tFn('fun.newRecord')}</div>
              )}
              <div className="flex justify-center gap-4 text-gray-700">
                <span>{tFn('fun.score')}: <b>{lastScore}</b></span>
                <span>{tFn('fun.record')}: <b>{lastResult.bestScore}</b></span>
                {lastResult.rank && <span>{tFn('fun.place')}: <b>#{lastResult.rank}</b></span>}
              </div>
              {lastResult.earnedPoints > 0 && (
                <div className="mt-1 text-coffee-600 font-bold">+{lastResult.earnedPoints} {tFn('fun.bonusPoints')}! ☕</div>
              )}
            </div>
          )}

          <CoffeeJumpGame onGameOver={handleGameOver} />
        </div>
      )}

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div className="flex-1 p-4 pb-24">
          <h2 className="text-lg font-bold text-coffee-800 mb-3">🏆 {tFn('fun.leaderboard')}</h2>
          {lbLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-12 rounded-xl" />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <span className="text-4xl block mb-2">🎮</span>
              {tFn('fun.noPlayers')}
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${
                    entry.rank <= 3
                      ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'
                      : 'bg-white border-gray-100'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    entry.rank === 1 ? 'bg-amber-400 text-white' :
                    entry.rank === 2 ? 'bg-gray-300 text-white' :
                    entry.rank === 3 ? 'bg-amber-600 text-white' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-gray-800">{entry.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-coffee-600">☕ {entry.score.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rewards Tab */}
      {tab === 'rewards' && (
        <div className="flex-1 p-4 pb-24">
          <h2 className="text-lg font-bold text-coffee-800 mb-3">🎁 {tFn('fun.gameRewards')}</h2>

          {statsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : stats ? (
            <>
              {/* Stats summary */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-white p-3 rounded-xl border border-gray-100 text-center">
                  <div className="text-lg font-bold text-coffee-600">☕ {stats.bestScore}</div>
                  <div className="text-[10px] text-gray-400">{tFn('fun.record')}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100 text-center">
                  <div className="text-lg font-bold text-coffee-600">{stats.rank ? `#${stats.rank}` : '—'}</div>
                  <div className="text-[10px] text-gray-400">{tFn('fun.place')}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-gray-100 text-center">
                  <div className="text-lg font-bold text-coffee-600">{stats.playsToday}/{stats.playsLimit}</div>
                  <div className="text-[10px] text-gray-400">{tFn('fun.gamesToday')}</div>
                </div>
              </div>

              {/* Reward milestones */}
              <h3 className="font-bold text-gray-700 mb-2 text-sm">{tFn('fun.gameRewards')}</h3>
              <div className="space-y-2">
                {stats.rewards.map((r) => {
                  const reached = stats.bestScore >= r.score
                  return (
                    <div
                      key={r.score}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        r.claimed
                          ? 'bg-green-50 border-green-200'
                          : reached
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <div className={`text-2xl ${r.claimed ? '' : reached ? 'grayscale-0' : 'grayscale opacity-40'}`}>
                        {r.claimed ? '✅' : reached ? '🎉' : '🔒'}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-sm text-gray-800">{tFn('fun.scoreNeeded', { n: r.score.toLocaleString() })}</div>
                        <div className="text-xs text-gray-500">+{r.points} {tFn('fun.bonusPoints')}</div>
                      </div>
                      <div className={`text-xs font-bold px-2 py-1 rounded-full ${
                        r.claimed ? 'bg-green-100 text-green-700' : reached ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                        {r.claimed ? tFn('fun.claimed') : reached ? tFn('fun.achieved') : `${stats.bestScore}/${r.score}`}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400 py-12">
              <span className="text-4xl block mb-2">🎮</span>
              Зіграй хоча б раз, щоб побачити статистику
            </div>
          )}
        </div>
      )}

      {/* Radio Tab */}
      {tab === 'radio' && (
        <div className="flex-1 p-4 pb-24">
          <audio ref={audioRef} preload="none" />
          <div className="flex flex-col items-center text-center">
            <div className="relative w-40 h-40 mb-6 mx-auto">
              {radioPlaying && (
                <div className="absolute inset-0 bg-coffee-200 rounded-full animate-ping opacity-20" />
              )}
              <div className="absolute inset-2 bg-coffee-600 rounded-full shadow-lg flex items-center justify-center">
                <span className="text-5xl">📻</span>
              </div>
            </div>

            {radioLoading ? (
              <div className="space-y-2 w-full max-w-xs">
                <div className="skeleton h-6 rounded w-2/3 mx-auto" />
                <div className="skeleton h-4 rounded w-1/2 mx-auto" />
              </div>
            ) : radioTrack ? (
              <>
                <h2 className="text-xl font-bold text-gray-800">{radioTrack.title}</h2>
                <p className="text-gray-500 text-sm mt-1">{radioTrack.artist}</p>
                {radioTrack.genre && (
                  <span className="mt-2 text-xs bg-coffee-50 text-coffee-600 px-3 py-1 rounded-full font-medium">
                    {radioTrack.genre}
                  </span>
                )}

                <button
                  onClick={handleRadioToggle}
                  className="mt-6 w-16 h-16 rounded-full bg-coffee-600 text-white flex items-center justify-center text-2xl shadow-lg active:scale-95 transition-transform mx-auto"
                >
                  {radioPlaying ? '⏸' : '▶️'}
                </button>

                {radioPlaying && (
                  <div className="mt-4 flex items-center justify-center gap-1.5">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className="w-1 bg-coffee-400 rounded-full animate-pulse"
                        style={{ height: `${8 + (i % 3) * 6}px`, animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                    <span className="text-xs text-gray-400 ml-2">{tFn('fun.nowPlaying')}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="text-gray-400 py-8">
                <span className="text-4xl block mb-2">🎵</span>
                {tFn('fun.noTracks')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
