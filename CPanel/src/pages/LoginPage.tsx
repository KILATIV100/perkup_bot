import { useEffect, useRef, useState } from 'react'
import { authApi } from '../lib/api'
import { useAuthStore } from '../stores/auth'

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME || 'PerkUpCoffeeBot'

export default function LoginPage() {
  const { setAuth } = useAuthStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    (window as any).onTelegramCPanelAuth = async (tgUser: any) => {
      setLoading(true)
      setError('')
      try {
        const res = await authApi.loginWithWidget(tgUser)
        const { token, user } = res.data
        if (!['ADMIN', 'OWNER'].includes(user.role)) {
          setError('⛔ Доступ лише для адміністраторів')
          setLoading(false)
          return
        }
        setAuth(token, user)
      } catch (e: any) {
        setError(e.response?.data?.error || 'Помилка авторизації')
        setLoading(false)
      }
    }

    if (containerRef.current) {
      const script = document.createElement('script')
      script.src = 'https://telegram.org/js/telegram-widget.js?22'
      script.setAttribute('data-telegram-login', BOT_USERNAME)
      script.setAttribute('data-size', 'large')
      script.setAttribute('data-radius', '12')
      script.setAttribute('data-onauth', 'onTelegramCPanelAuth(user)')
      script.setAttribute('data-request-access', 'write')
      script.async = true
      containerRef.current.innerHTML = ''
      containerRef.current.appendChild(script)
    }

    return () => {
      delete (window as any).onTelegramCPanelAuth
    }
  }, [setAuth])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-coffee-900 via-coffee-800 to-coffee-600 px-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center space-y-6">
        <div className="text-5xl">☕</div>
        <div>
          <h1 className="text-2xl font-bold text-coffee-800">PerkUp CPanel</h1>
          <p className="text-gray-500 text-sm mt-1">Панель адміністратора</p>
        </div>

        {loading ? (
          <div className="py-4 text-gray-500">Авторизація...</div>
        ) : (
          <div ref={containerRef} className="flex justify-center" />
        )}

        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        <p className="text-xs text-gray-400">
          Увійдіть через Telegram для доступу<br />до адмін-панелі PerkUp
        </p>
      </div>
    </div>
  )
}
