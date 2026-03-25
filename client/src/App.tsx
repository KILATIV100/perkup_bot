import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth'

// Pages
import MenuPage from './pages/MenuPage'
import ProfilePage from './pages/ProfilePage'
import OnboardingPage from './pages/OnboardingPage'
import LoadingScreen from './components/LoadingScreen'
import BottomNav from './components/BottomNav'
import Header from './components/Header'

declare global {
  interface Window {
    Telegram?: {
      WebApp: any
    }
    __hideSplash?: () => void
  }
}

export default function App() {
  const { login, isAuthenticated, isLoading, user } = useAuthStore()

  useEffect(() => {
    login()
  }, [])

  if (isLoading) return <LoadingScreen />

  if (!isAuthenticated) return <LoadingScreen message="Авторизація..." />

  if (user && !user.onboardingDone) {
    return <OnboardingPage />
  }

  return (
    <div className="min-h-screen bg-coffee-50 flex flex-col">
      <Header />
      <main className="flex-1 pb-safe">
        <Routes>
          <Route path="/" element={<Navigate to="/menu" replace />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/menu" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
