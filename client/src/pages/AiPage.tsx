import { useState, useEffect } from 'react'
import { aiApi } from '../lib/api'
import { useLocationStore } from '../stores/location'

interface WeatherData {
  temp: number
  description: string
  recommendation: string
}

interface CardOfDay {
  drinkName: string
  description: string
}

interface CoffeeFact {
  fact: string
}

interface MoodResult {
  recommendation: string
  matchedDrink: string | null
}

interface DailyChallenge {
  challenge: string
  points: number
  claimed: boolean
  dateKey: string
}

export default function AiPage() {
  const { activeLocation } = useLocationStore()

  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [card, setCard] = useState<CardOfDay | null>(null)
  const [fact, setFact] = useState<CoffeeFact | null>(null)
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null)

  const [mood, setMood] = useState('')
  const [moodResult, setMoodResult] = useState<MoodResult | null>(null)
  const [moodLoading, setMoodLoading] = useState(false)

  const [claimLoading, setClaimLoading] = useState(false)
  const [claimMsg, setClaimMsg] = useState('')

  const [loadingWeather, setLoadingWeather] = useState(true)
  const [loadingCard, setLoadingCard] = useState(true)
  const [loadingFact, setLoadingFact] = useState(true)
  const [loadingChallenge, setLoadingChallenge] = useState(true)

  useEffect(() => {
    aiApi.weatherMenu()
      .then(r => setWeather(r.data))
      .catch(() => setWeather(null))
      .finally(() => setLoadingWeather(false))

    aiApi.cardOfDay()
      .then(r => setCard(r.data))
      .catch(() => setCard(null))
      .finally(() => setLoadingCard(false))

    aiApi.coffeeFact()
      .then(r => setFact(r.data))
      .catch(() => setFact(null))
      .finally(() => setLoadingFact(false))

    aiApi.dailyChallenge()
      .then(r => setChallenge(r.data))
      .catch(() => setChallenge(null))
      .finally(() => setLoadingChallenge(false))
  }, [])

  const handleMoodSubmit = async () => {
    if (!mood.trim()) return
    setMoodLoading(true)
    setMoodResult(null)
    try {
      const res = await aiApi.moodMenu(mood.trim(), activeLocation?.slug)
      setMoodResult(res.data)
    } catch {
      setMoodResult({ recommendation: 'Не вдалося отримати рекомендацію', matchedDrink: null })
    } finally {
      setMoodLoading(false)
    }
  }

  const handleClaim = async () => {
    if (!challenge || challenge.claimed || claimLoading) return
    setClaimLoading(true)
    setClaimMsg('')
    try {
      const res = await aiApi.claimChallenge()
      setClaimMsg('+' + res.data.pointsAdded + ' балів зараховано!')
      setChallenge(prev => prev ? { ...prev, claimed: true } : prev)
    } catch (e: any) {
      setClaimMsg(e?.response?.data?.error || 'Помилка')
    } finally {
      setClaimLoading(false)
    }
  }

  const MOODS = ['😊 Радісний', '😴 Сонний', '💪 Енергійний', '😌 Спокійний', '🥶 Холодно', '🔥 Жарко']

  return (
    <div className="p-4 space-y-4 pb-24">
      <h1 className="text-2xl font-bold text-coffee-700">✨ AI-куточок</h1>

      {/* Weather Banner */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-4 text-white shadow">
        <div className="text-xs font-medium opacity-80 mb-1">Бровари, зараз</div>
        {loadingWeather ? (
          <div className="animate-pulse h-16 bg-white/20 rounded-xl" />
        ) : weather ? (
          <>
            <div className="text-3xl font-bold mb-1">{weather.temp}°C</div>
            <div className="text-sm opacity-90 capitalize mb-3">{weather.description}</div>
            {weather.recommendation && (
              <div className="bg-white/20 rounded-xl p-3 text-sm leading-relaxed">
                {weather.recommendation}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm opacity-80">Не вдалося завантажити погоду</div>
        )}
      </div>

      {/* Card of Day */}
      <div className="bg-white rounded-2xl p-4 shadow border border-gray-100">
        <div className="text-xs text-coffee-500 font-semibold uppercase tracking-wider mb-2">☕ Кава дня</div>
        {loadingCard ? (
          <div className="space-y-2">
            <div className="animate-pulse h-5 bg-gray-100 rounded w-1/2" />
            <div className="animate-pulse h-16 bg-gray-100 rounded" />
          </div>
        ) : card ? (
          <>
            <div className="font-bold text-coffee-800 text-lg mb-2">{card.drinkName}</div>
            <div className="text-gray-600 text-sm leading-relaxed italic">{card.description}</div>
          </>
        ) : (
          <div className="text-gray-400 text-sm">Недоступно</div>
        )}
      </div>

      {/* Coffee Fact */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="text-xs text-amber-700 font-semibold uppercase tracking-wider mb-2">🌿 Факт дня</div>
        {loadingFact ? (
          <div className="animate-pulse h-10 bg-amber-100 rounded" />
        ) : fact ? (
          <div className="text-gray-700 text-sm leading-relaxed">{fact.fact}</div>
        ) : (
          <div className="text-gray-400 text-sm">Недоступно</div>
        )}
      </div>

      {/* Mood Picker */}
      <div className="bg-white rounded-2xl p-4 shadow border border-gray-100">
        <div className="text-xs text-coffee-500 font-semibold uppercase tracking-wider mb-3">🎭 Настрій → Напій</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {MOODS.map(m => (
            <button
              key={m}
              onClick={() => setMood(m)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                mood === m
                  ? 'bg-coffee-600 text-white border-coffee-600'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-coffee-300'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={mood}
            onChange={e => setMood(e.target.value)}
            placeholder="або опишіть свій стан..."
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-coffee-400"
            onKeyDown={e => { if (e.key === 'Enter') handleMoodSubmit() }}
          />
          <button
            onClick={handleMoodSubmit}
            disabled={moodLoading || !mood.trim()}
            className="px-4 py-2 bg-coffee-600 text-white rounded-xl text-sm disabled:opacity-50 whitespace-nowrap"
          >
            {moodLoading ? '...' : 'Підібрати'}
          </button>
        </div>
        {moodResult && (
          <div className="mt-3 bg-coffee-50 rounded-xl p-3 text-sm text-gray-700 leading-relaxed">
            {moodResult.matchedDrink && (
              <div className="font-semibold text-coffee-700 mb-1">☕ {moodResult.matchedDrink}</div>
            )}
            {moodResult.recommendation}
          </div>
        )}
      </div>

      {/* Daily Challenge */}
      <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 text-white shadow">
        <div className="text-xs font-medium opacity-80 mb-2">🏆 Щоденний челендж</div>
        {loadingChallenge ? (
          <div className="animate-pulse h-12 bg-white/20 rounded-xl" />
        ) : challenge ? (
          <>
            <div className="text-sm leading-relaxed mb-3">{challenge.challenge}</div>
            <div className="flex items-center justify-between">
              <span className="text-xs opacity-80">+{challenge.points} балів за виконання</span>
              {challenge.claimed ? (
                <span className="bg-white/30 px-3 py-1.5 rounded-xl text-xs font-semibold">
                  ✓ Виконано
                </span>
              ) : (
                <button
                  onClick={handleClaim}
                  disabled={claimLoading}
                  className="bg-white text-purple-700 px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-60"
                >
                  {claimLoading ? '...' : 'Отримати бали'}
                </button>
              )}
            </div>
            {claimMsg && (
              <div className="mt-2 text-xs bg-white/20 rounded-lg px-3 py-1.5">{claimMsg}</div>
            )}
          </>
        ) : (
          <div className="text-sm opacity-80">Недоступно</div>
        )}
      </div>
    </div>
  )
}
