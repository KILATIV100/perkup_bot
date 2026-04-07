import { useEffect, useState } from 'react'
import { useLocationStore } from '../stores/location'
import { aiApi } from '../lib/api'

const MOOD_OPTIONS = [
  { emoji: '😊', label: 'Радісний', value: 'радісний, піднесений настрій' },
  { emoji: '😴', label: 'Сонний', value: 'сонний, потрібна енергія' },
  { emoji: '😰', label: 'Стрес', value: 'стрес, напруження' },
  { emoji: '🥶', label: 'Замерз', value: 'холодно, хочу зігрітись' },
  { emoji: '🤔', label: 'Задумливий', value: 'задумливий, хочу зосередитись' },
  { emoji: '🥵', label: 'Спека', value: 'спекотно, хочу охолодитись' },
  { emoji: '😌', label: 'Спокій', value: 'спокійний, розслаблений' },
  { emoji: '💪', label: 'Енергія', value: 'хочу заряд енергії і бадьорості' },
]

export default function AiPage() {
  const { activeLocation } = useLocationStore()
  const slug = activeLocation?.slug

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

  // Load weather on page open
  useEffect(() => {
    if (!slug) return
    setWeatherLoading(true)
    aiApi.weatherMenu(slug)
      .then(res => setWeather(res.data))
      .catch(() => setWeather(null))
      .finally(() => setWeatherLoading(false))
  }, [slug])

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

  if (!activeLocation) {
    return (
      <div className="p-4 pb-24 text-center text-gray-500">
        Оберіть локацію у хедері, щоб отримати персональні рекомендації.
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 space-y-5">
      <h1 className="text-2xl font-bold text-coffee-800">Бариста AI ✨</h1>
      <p className="text-xs text-gray-400">Рекомендації з меню: {activeLocation.name}</p>

      {/* === WEATHER BLOCK === */}
      <div className="bg-gradient-to-br from-blue-50 to-sky-50 p-4 rounded-2xl border border-blue-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🌤️</span>
          <h2 className="font-bold text-blue-800">Погода і напій</h2>
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
              Зараз {weather.temp}°C, {weather.description}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">{weather.recommendation}</p>
            {weather.matchedDrink && (
              <div className="mt-2 inline-block bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">
                ☕ {weather.matchedDrink}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">Не вдалося завантажити рекомендацію</p>
        )}
      </div>

      {/* === MOOD BLOCK === */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🎭</span>
          <h2 className="font-bold text-gray-800">Підбір за настроєм</h2>
        </div>
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
      </div>

      {/* === PERSONAL BLOCK === */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-2xl border border-amber-100">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">🔮</span>
          <h2 className="font-bold text-amber-800">Персональна рекомендація</h2>
        </div>
        <p className="text-xs text-amber-600 mb-3">На основі твоїх попередніх замовлень</p>

        {!personal && !personalLoading && (
          <button
            onClick={handlePersonal}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-colors active:scale-[0.98]"
          >
            Отримати рекомендацію
          </button>
        )}

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
                <span className="text-xs text-amber-600">Твої улюблені:</span>
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
              Оновити рекомендацію
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
