import { useEffect, useRef, useState } from 'react'
import { authApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'
import { useT } from '../lib/i18n'

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'PerkUpCoffeeBot'

declare global {
  interface Window {
    onTelegramAuth?: (user: any) => void
  }
}

export default function LoginPage() {
  const { updateUser } = useAuthStore()
  const widgetRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const t = useT()

  useEffect(() => {
    // Telegram Login Widget callback
    window.onTelegramAuth = async (tgUser: any) => {
      setLoading(true)
      setError('')
      try {
        const res = await authApi.loginWithWidget(tgUser)
        const { token, user } = res.data
        localStorage.setItem('perkup_token', token)
        useAuthStore.setState({ token, user, isAuthenticated: true, isLoading: false })
        window.__hideSplash?.()
      } catch (e: any) {
        setError(e.response?.data?.error || t('login.error'))
      }
      setLoading(false)
    }

    // Inject Telegram Login Widget script
    if (widgetRef.current && !widgetRef.current.hasChildNodes()) {
      const script = document.createElement('script')
      script.src = 'https://telegram.org/js/telegram-widget.js?22'
      script.async = true
      script.setAttribute('data-telegram-login', BOT_USERNAME)
      script.setAttribute('data-size', 'large')
      script.setAttribute('data-radius', '12')
      script.setAttribute('data-onauth', 'onTelegramAuth(user)')
      script.setAttribute('data-request-access', 'write')
      widgetRef.current.appendChild(script)
    }

    return () => {
      delete window.onTelegramAuth
    }
  }, [])

  return (
    <div className="min-h-screen bg-coffee-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg p-8 text-center space-y-6">
        {/* Logo */}
        <div className="space-y-2">
          <div className="text-5xl">☕</div>
          <h1 className="text-2xl font-bold text-coffee-700">PerkUp</h1>
          <p className="text-sm text-gray-500">{t('login.tagline')}</p>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Description */}
        <div className="space-y-2">
          <p className="text-gray-700 font-medium">{t('login.telegram')}</p>
          <p className="text-xs text-gray-400">
            {t('login.authDesc')}
          </p>
        </div>

        {/* Telegram Widget */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-3">
            <div className="w-5 h-5 border-2 border-coffee-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500">{t('login.loggingIn')}</span>
          </div>
        ) : (
          <div ref={widgetRef} className="flex justify-center" />
        )}

        {error && (
          <div className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</div>
        )}

        {/* Footer */}
        <p className="text-[10px] text-gray-300">
          {t('login.terms')}
        </p>
      </div>
    </div>
  )
}
