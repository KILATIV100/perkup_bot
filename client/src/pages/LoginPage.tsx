import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { useT } from '../lib/i18n'

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'perkup_ua_bot'

declare global {
  interface Window {
    onTelegramAuth?: (user: any) => void
  }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const widgetRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const t = useT()

  useEffect(() => {
    window.onTelegramAuth = async (tgUser: any) => {
      setLoading(true)
      setError('')
      try {
        const res = await authApi.loginWithWidget(tgUser)
        const { token, user } = res.data
        localStorage.setItem('perkup_token', token)
        useAuthStore.setState({ token, user, isAuthenticated: true, isLoading: false })
        window.__hideSplash?.()
        navigate('/menu')
      } catch (e: any) {
        setError(e.response?.data?.error || 'Помилка входу. Спробуй ще раз.')
      }
      setLoading(false)
    }

    if (widgetRef.current && !widgetRef.current.hasChildNodes()) {
      const script = document.createElement('script')
      script.src = 'https://telegram.org/js/telegram-widget.js?22'
      script.async = true
      script.setAttribute('data-telegram-login', BOT_USERNAME)
      script.setAttribute('data-size', 'large')
      script.setAttribute('data-radius', '12')
      script.setAttribute('data-onauth', 'onTelegramAuth(user)')
      script.setAttribute('data-request-access', 'write')
      script.setAttribute('data-lang', 'uk')
      widgetRef.current.appendChild(script)
    }

    return () => { delete window.onTelegramAuth }
  }, [navigate])

  return (
    <div className="min-h-screen bg-coffee-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-7xl mb-3">☕</div>
          <h1 className="text-3xl font-bold text-coffee-700">PerkUp</h1>
          <p className="text-gray-400 text-sm mt-1">Кав'ярня з бонусами та грою</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-lg p-7 space-y-5">

          {/* Features */}
          <div className="space-y-3">
            {[
              { icon: '🎡', text: 'Бонусні бали за кожне замовлення' },
              { icon: '📱', text: 'Передзамовлення — без черги' },
              { icon: '🎮', text: 'Ігри та нагороди' },
            ].map(f => (
              <div key={f.icon} className="flex items-center gap-3">
                <span className="text-xl w-8 text-center">{f.icon}</span>
                <span className="text-sm text-gray-600">{f.text}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100" />

          {/* Widget */}
          <div className="text-center space-y-3">
            <p className="text-sm font-medium text-gray-700">Увійти через Telegram</p>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-3">
                <div className="w-5 h-5 border-2 border-coffee-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-500">Входимо...</span>
              </div>
            ) : (
              <div ref={widgetRef} className="flex justify-center" />
            )}

            {error && (
              <div className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</div>
            )}
          </div>

          <p className="text-[10px] text-gray-300 text-center">
            Натискаючи кнопку, ви погоджуєтесь з умовами використання
          </p>
        </div>

        {/* Back */}
        <button
          onClick={() => navigate('/menu')}
          className="w-full mt-4 py-3 text-sm text-coffee-500 font-medium"
        >
          ← Переглянути меню без входу
        </button>
      </div>
    </div>
  )
}
