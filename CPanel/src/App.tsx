import { useEffect } from 'react'
import { useAuthStore } from './stores/auth'
import AdminPanel from './pages/AdminPanel'

export default function App() {
  const { isLoading, checkAuth } = useAuthStore()

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

  return <AdminPanel />
}
