import { useEffect, useState } from 'react'
import { useLocationStore } from '../stores/location'
import { useAuthStore } from '../stores/auth'
import { aiApi } from '../lib/api'
import { useT } from '../lib/i18n'

export default function AiPage() {
  const { activeLocation } = useLocationStore()
  const { isAuthenticated } = useAuthStore()
  const slug = activeLocation?.slug
  const t = useT()

  const MOOD_OPTIONS = [
    { emoji: '😊', label: t('ai.mood.happy'), value: 'радісний, піднесений настрій' },
    { emoji: '😴', label: t('ai.mood.sleepy'), value: 'сонний, потрібна енергія' },
    { emoji: '😰', label: t('ai.mood.stressed'), value: 'стрес, напруження' },
    { emoji: '🥶', label: t('ai.mood.cold'), value: 'холодно, хочу зігрітись' },
    { emoji: '🤔', label: t('ai.mood.thinking'), value: 'задумливий, хочу зосередитись' },
    { emoji: '🥵', label: t('ai.mood.hot'), value: 'спекотно, хочу охолодитись' },
    { emoji: '😌', label: t('ai.mood.calm'), value: 'спокійний, розслаблений' },
    { emoji: '💪', label: t('ai.mood.energy'), value: 'хочу заряд енергії і бадьорості' },
  ]

  // Weather recommendation
  const [weather, setWeather] = useState<{ temp: number; description: string; recommendation: string; matchedDrink?: string } | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)

  // Mood recommendation
  const [moodResult, setMoodResult] = useState<{ recommendation: string; matchedDrink?: string } | null>(null)
  const [moodLoading, setMoodLoading] = useState(false)
  const [selectedMood, setSelectedMood] = useState<string | null>(null)

  // Personal recommendation
  const [personal, setPersonal] = useState<{ recommendation: string; matchedDrink?: string; favorites: string[]; hasHistory: boolean } | null>(null)
  const [personalLoading, setPersonalLoading] = useState(false)

  // Card of Day
  const [cardOfDay, setCardOfDay] = useState<{ drinkName: string; description: string } | null>(null)
  const [cardLoading, setCardLoading] = useState(false)

  // Coffee Fact
  const [coffeeFact, setCoffeeFact] = useState<string | null>(null)
  const [factLoading, setFactLoading] = useState(false)

  // Daily Challenge
  const [challenge, setChallenge] = useState<{ challenge: string; points: number; claimed: boolean } | null>(null)
  const [challengeLoading, setChallengeLoading] = useState(false)
  const [claiming, setClaiming] = useState(false)

  // Load weather + card of day + fact + challenge on page open
  useEffect(() => {
    if (!slug) return
    setWeatherLoading(true)
    aiApi.weatherMenu(slug)
      .then(res => setWeather(res.data))
      .catch(() => setWeather(null))
      .finally(() => setWeatherLoading(false))
  }, [slug])

  useEffect(() => {
    setCardLoading(true)
    aiApi.cardOfDay()
      .then(res => setCardOfDay(res.data))
      .catch(() => setCardOfDay(null))
      .finally(() => setCardLoading(false))

    setFactLoading(true)
    aiApi.coffeeFact()
      .then(res => setCoffeeFact(res.data?.fact || null))
      .catch(() => setCoffeeFact(null))
      .finally(() => setFactLoading(false))

    setChallengeLoading(true)
    aiApi.dailyChallenge()
      .then(res => setChallenge(res.data))
      .catch(() => setChallenge(null))
      .finally(() => setChallengeLoading(false))
  }, [])

  const handleMood = async (mood: string) => {
    if (!slug) return
    setSelectedMood(mood)
    setMoodLoading(true)
    setMoodResult(null)
    try {
      const res = await aiApi.moodMenu(mood, slug)
      setMoodResult(res.data)
    } catch {
      setMoodResult(null)
    } finally {
      setMoodLoading(false)
    }
  }

  const handlePersonal = async () => {
    if (!slug) return
    setPersonalLoading(true)
    setPersonal(null)
    try {
      const res = await aiApi.personalRecommend(slug)
      setPersonal(res.data)
    } catch {
      setPersonal(null)
    } finally {
      setPersonalLoading(false)
    }
  }

  const handleClaim = async () => {
    if (claiming || !challenge || challenge.claimed) return
    setClaiming(true)
    try {
      await aiApi.claimChallenge()
      setChallenge(prev => prev ? { ...prev, claimed: true } : null)
    } catch { /* ignore */ }
    finally { setClaiming(false) }
  }

  if (!activeLocation) {
    return (
      <div className="p-4 pb-24 text-center text-gray-500">
        {t('ai.selectLocation')}
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 space-y-5">
      <h1 className="text-2xl font-bold text-coffee-800">{t('ai.title')}</h1>
      <p className="text-xs text-gray-400">{t('ai.locationHint')} {activeLocation.name}</p>

      {/* === WEATHER BLOCK === */}
      <div className="bg-gradient-to-br from-blue-50 to-sky-50 p-4 rounded-2xl border border-blue-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🌤️</span>
          <h2 className="font-bold text-blue-800">{t('ai.weather')}</h2>
        </div>
        {weatherLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-blue-100 rounded w-1/3" />
            <div className="h-4 bg-blue-100 rounded w-full" />
            <div className="h-4 bg-blue-100 rounded w-2/3" />
          </div>
        ) : weather ? (
          <>
            <p className="text-blue-700 font-medium text-sm mb-1">
              {t('ai.weatherNow')} {weather.temp}°C, {weather.description}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">{weather.recommendation}</p>
            {weather.matchedDrink && (
              <div className="mt-2 inline-block bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">
                ☕ {weather.matchedDrink}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">{t('common.loadFailed')}</p>
        )}
      </div>

      {/* === MOOD BLOCK === */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🎭</span>
          <h2 className="font-bold text-gray-800">{t('ai.mood')}</h2>
        </div>
        {!isAuthenticated ? (
          <p className="text-sm text-gray-400">{t('ai.loginRequired')}</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {MOOD_OPTIONS.map(m => (
                <button
                  key={m.label}
                  onClick={() => handleMood(m.value)}
                  disabled={moodLoading}
                  className={`flex flex-col items-center p-2 rounded-xl transition-all active:scale-95 ${
                    selectedMood === m.value
                      ? 'bg-coffee-100 border-2 border-coffee-400'
                      : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xl">{m.emoji}</span>
                  <span className="text-[10px] text-gray-600 mt-1">{m.label}</span>
                </button>
              ))}
            </div>
            {moodLoading && (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-full" />
                <div className="h-4 bg-gray-100 rounded w-2/3" />
              </div>
            )}
            {moodResult && !moodLoading && (
              <div className="bg-coffee-50/50 p-3 rounded-xl">
                <p className="text-sm text-gray-700 leading-relaxed">{moodResult.recommendation}</p>
                {moodResult.matchedDrink && (
                  <div className="mt-2 inline-block bg-coffee-100 text-coffee-800 text-xs font-bold px-3 py-1 rounded-full">
                    ☕ {moodResult.matchedDrink}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* === PERSONAL BLOCK === */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-2xl border border-amber-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🔮</span>
          <h2 className="font-bold text-amber-800">{t('ai.personal')}</h2>
        </div>
        <p className="text-xs text-amber-600 mb-3">{t('ai.personalSubtitle')}</p>

        {!isAuthenticated ? (
          <p className="text-sm text-gray-400">{t('ai.loginRequired')}</p>
        ) : !personal && !personalLoading ? (
          <button
            onClick={handlePersonal}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors active:scale-[0.98]"
          >
            {t('ai.getRecommendation')}
          </button>
        ) : null}

        {personalLoading && (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-amber-100 rounded w-full" />
            <div className="h-4 bg-amber-100 rounded w-2/3" />
            <div className="h-4 bg-amber-100 rounded w-1/2" />
          </div>
        )}

        {personal && !personalLoading && (
          <div>
            {personal.hasHistory && personal.favorites.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                <span className="text-xs text-amber-600">{t('ai.favorites')}</span>
                {personal.favorites.map(f => (
                  <span key={f} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{f}</span>
                ))}
              </div>
            )}
            <p className="text-sm text-gray-700 leading-relaxed">{personal.recommendation}</p>
            {personal.matchedDrink && (
              <div className="mt-2 inline-block bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">
                ☕ {personal.matchedDrink}
              </div>
            )}
            <button
              onClick={handlePersonal}
              className="mt-3 w-full text-amber-600 text-sm font-medium py-2 rounded-xl border border-amber-200 hover:bg-amber-50 transition-colors active:scale-[0.98]"
            >
              {t('ai.refreshRecommendation')}
            </button>
          </div>
        )}
      </div>

      {/* === CARD OF DAY === */}
      <div className="bg-gradient-to-br from-rose-50 to-pink-50 p-4 rounded-2xl border border-rose-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🃏</span>
          <h2 className="font-bold text-rose-800">{t('ai.cardOfDay')}</h2>
        </div>
        {cardLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-5 bg-rose-100 rounded w-1/3" />
            <div className="h-4 bg-rose-100 rounded w-full" />
            <div className="h-4 bg-rose-100 rounded w-2/3" />
          </div>
        ) : cardOfDay ? (
          <>
            <div className="text-lg font-bold text-rose-700 mb-1">{cardOfDay.drinkName}</div>
            <p className="text-sm text-gray-700 leading-relaxed italic">{cardOfDay.description}</p>
          </>
        ) : (
          <p className="text-sm text-gray-400">{t('common.loadFailed')}</p>
        )}
      </div>

      {/* === COFFEE FACT === */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-2xl border border-emerald-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">💡</span>
          <h2 className="font-bold text-emerald-800">{t('ai.coffeeFact')}</h2>
        </div>
        {factLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-emerald-100 rounded w-full" />
            <div className="h-4 bg-emerald-100 rounded w-2/3" />
          </div>
        ) : coffeeFact ? (
          <p className="text-sm text-gray-700 leading-relaxed">{coffeeFact}</p>
        ) : (
          <p className="text-sm text-gray-400">{t('common.loadFailed')}</p>
        )}
      </div>

      {/* === DAILY CHALLENGE === */}
      <div className="bg-gradient-to-br from-violet-50 to-indigo-50 p-4 rounded-2xl border border-violet-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🎯</span>
          <h2 className="font-bold text-violet-800">{t('ai.dailyChallenge')}</h2>
        </div>
        {challengeLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-violet-100 rounded w-full" />
            <div className="h-4 bg-violet-100 rounded w-1/2" />
          </div>
        ) : challenge ? (
          <>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">{challenge.challenge}</p>
            {challenge.claimed ? (
              <div className="text-center text-sm text-violet-600 font-semibold bg-violet-100 rounded-xl py-2.5">
                ✅ {t('ai.challengeDone')} +{challenge.points} {t('profile.points')}
              </div>
            ) : isAuthenticated ? (
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl transition-colors active:scale-[0.98] disabled:opacity-60"
              >
                {claiming ? '⏳ ...' : t('ai.claimChallenge', { n: challenge.points })}
              </button>
            ) : (
              <p className="text-sm text-gray-400">{t('ai.loginRequired')}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">{t('common.loadFailed')}</p>
        )}
      </div>
    </div>
  )
}
