import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth'
import MenuPage from './pages/MenuPage'
import ProfilePage from './pages/ProfilePage'
import OnboardingPage from './pages/OnboardingPage'
import BonusesPage from './pages/BonusesPage'
import AiPage from './pages/AiPage'
import RadioPage from './pages/RadioPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import OrderStatusPage from './pages/OrderStatusPage'
import LoadingScreen from './components/LoadingScreen'
import BottomNav from './components/BottomNav'
import Header from './components/Header'

export default function App() {
  const { login, isAuthenticated, isLoading, user } = useAuthStore()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    login().finally(() => setInitialized(true))
  }, [])

  // Show loading only while login is in progress
  if (!initialized || isLoading) return <LoadingScreen />

  // Not authenticated after init - show menu anyway (guest mode) or re-try
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-coffee-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">☕</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">PerkUp</h2>
          <p className="text-gray-500 text-sm mb-6">Відкрий через Telegram бота</p>
          <button onClick={() => { login().finally(() => setInitialized(true)) }}
            className="bg-amber-700 text-white px-6 py-3 rounded-2xl font-semibold">
            Спробувати знову
          </button>
        </div>
      </div>
    )
  }

  if (user && !user.onboardingDone) return <OnboardingPage />

  return (
    <div className="min-h-screen bg-coffee-50 flex flex-col">
      <Header />
      <main className="flex-1 pb-safe">
        <Routes>
          <Route path="/" element={<Navigate to="/menu" replace />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/radio" element={<RadioPage />} />
          <Route path="/ai" element={<AiPage />} />
          <Route path="/bonuses" element={<BonusesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders/:id" element={<OrderStatusPage />} />
          <Route path="*" element={<Navigate to="/menu" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
