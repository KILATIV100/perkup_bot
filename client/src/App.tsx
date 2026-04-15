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
import SettingsPage from './pages/SettingsPage'
import AdminPage from './pages/AdminPage'
import LoginPage from './pages/LoginPage'
import LoadingScreen from './components/LoadingScreen'
import BottomNav from './components/BottomNav'
import Header from './components/Header'

export default function App() {
  const { login, isAuthenticated, isLoading, user } = useAuthStore()
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    login().finally(() => {
      setInitialized(true)
      window.__hideSplash?.()
    })
  }, [])

  if (!initialized || isLoading) return <LoadingScreen />

  // Authenticated but no onboarding — show onboarding
  if (isAuthenticated && user && !user.onboardingDone) return <OnboardingPage />

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
          <Route path="/login" element={isAuthenticated ? <Navigate to="/menu" replace /> : <LoginPage />} />
          {/* Auth-required routes */}
          <Route path="/bonuses" element={isAuthenticated ? <BonusesPage /> : <LoginPage />} />
          <Route path="/profile" element={isAuthenticated ? <ProfilePage /> : <LoginPage />} />
          <Route path="/settings" element={isAuthenticated ? <SettingsPage /> : <LoginPage />} />
          <Route path="/admin" element={isAuthenticated ? <AdminPage /> : <LoginPage />} />
          <Route path="/cart" element={isAuthenticated ? <CartPage /> : <LoginPage />} />
          <Route path="/checkout" element={isAuthenticated ? <CheckoutPage /> : <LoginPage />} />
          <Route path="/orders/:id" element={isAuthenticated ? <OrderStatusPage /> : <LoginPage />} />
          <Route path="*" element={<Navigate to="/menu" replace />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
