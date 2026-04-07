import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth'
import MenuPage from './pages/MenuPage'
import ProfilePage from './pages/ProfilePage'
import OnboardingPage from './pages/OnboardingPage'
import BonusesPage from './pages/BonusesPage'
import AiPage from './pages/AiPage'
import FunPage from './pages/FunPage'
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

  if (!initialized || isLoading) return <LoadingScreen />

  if (user && !user.onboardingDone) return <OnboardingPage />

  return (
    <div className="min-h-screen bg-coffee-50 flex flex-col">
      <Header />
      <main className="flex-1 pb-safe">
        <Routes>
          <Route path="/" element={<Navigate to="/menu" replace />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/fun" element={<FunPage />} />
          <Route path="/radio" element={<Navigate to="/fun" replace />} />
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
