import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '../lib/api'

interface User {
  id: number
  telegramId: string
  firstName: string
  lastName?: string
  username?: string
  role: string
  points: number
  level: string
  phone?: string | null
  language: string
  onboardingDone: boolean
  preferredLocationId?: number
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: () => Promise<void>
  logout: () => void
  updateUser: (data: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,

      login: async () => {
        // Already authenticated - skip
        if (get().isAuthenticated && get().user) return

        set({ isLoading: true })
        try {
          const tg = window.Telegram?.WebApp
          if (tg?.initData) {
            // In Telegram - use initData
            const res = await authApi.loginWithTelegram(tg.initData)
            const { token, user } = res.data
            localStorage.setItem('perkup_token', token)
            set({ token, user, isAuthenticated: true, isLoading: false })
            window.__hideSplash?.()
            return
          }

          // Not in Telegram - try saved token
          const savedToken = localStorage.getItem('perkup_token')
          if (savedToken) {
            try {
              const res = await authApi.getMe()
              const user = res.data.user
              set({ token: savedToken, user, isAuthenticated: true, isLoading: false })
              return
            } catch {
              localStorage.removeItem('perkup_token')
            }
          }

          // Dev fallback
          if (import.meta.env.DEV) {
            try {
              const res = await authApi.devLogin()
              const { token, user } = res.data
              localStorage.setItem('perkup_token', token)
              set({ token, user, isAuthenticated: true, isLoading: false })
              window.__hideSplash?.()
              return
            } catch {}
          }

          set({ isLoading: false })
        } catch (err) {
          console.error('Auth error:', err)
          set({ isLoading: false })
        }
      },

      logout: () => {
        localStorage.removeItem('perkup_token')
        set({ user: null, token: null, isAuthenticated: false })
      },

      updateUser: (data) => {
        const user = get().user
        if (user) set({ user: { ...user, ...data } })
      },
    }),
    {
      name: 'perkup-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)
