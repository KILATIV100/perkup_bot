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
        set({ isLoading: true })
        try {
          const tg = window.Telegram?.WebApp
          if (!tg?.initData) throw new Error('Not in Telegram')

          const res = await authApi.loginWithTelegram(tg.initData)
          const { token, user } = res.data

          localStorage.setItem('perkup_token', token)
          set({ token, user, isAuthenticated: true, isLoading: false })

          // Hide splash screen
          window.__hideSplash?.()
        } catch (err) {
          console.error('Auth error:', err)
          // In dev mode, fallback to backend dev-login to keep API flows working.
          if (import.meta.env.DEV) {
            try {
              const res = await authApi.devLogin()
              const { token, user } = res.data
              localStorage.setItem('perkup_token', token)
              set({ token, user, isAuthenticated: true, isLoading: false })
              window.__hideSplash?.()
              return
            } catch (devErr) {
              console.error('Dev login error:', devErr)
            }
          }

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
