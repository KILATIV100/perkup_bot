import { useEffect } from 'react'
import { useAuthStore } from './stores/auth'
import LoginPage from './pages/LoginPage'
import AdminPanel from './pages/AdminPanel'

export default function App() {
  const { isAuthenticated, isLoading, checkAuth, user } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-3">☕</div>
          <div className="text-gray-400 text-sm">Завантаження...</div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <LoginPage />
  }

  if (!['ADMIN', 'OWNER'].includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-sm">
          <div className="text-4xl mb-3">⛔</div>
          <h2 className="text-xl font-bold text-gray-800">Доступ заборонено</h2>
          <p className="text-gray-500 text-sm mt-2">CPanel доступний лише для адміністраторів</p>
          <button onClick={() => useAuthStore.getState().logout()}
            className="mt-4 px-6 py-2 rounded-xl bg-coffee-600 text-white text-sm font-semibold">
            Вийти
          </button>
        </div>
      </div>
    )
  }

  return <AdminPanel />
}
