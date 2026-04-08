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
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  checkAuth: () => Promise<void>
  setAuth: (token: string, user: User) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,

      checkAuth: async () => {
        const savedToken = localStorage.getItem('cpanel_token')
        if (!savedToken) {
          set({ isLoading: false })
          return
        }
        set({ isLoading: true })
        try {
          const res = await authApi.getMe()
          const user = res.data.user
          set({ token: savedToken, user, isAuthenticated: true, isLoading: false })
        } catch {
          localStorage.removeItem('cpanel_token')
          set({ user: null, token: null, isAuthenticated: false, isLoading: false })
        }
      },

      setAuth: (token, user) => {
        localStorage.setItem('cpanel_token', token)
        set({ token, user, isAuthenticated: true })
      },

      logout: () => {
        localStorage.removeItem('cpanel_token')
        set({ user: null, token: null, isAuthenticated: false })
      },
    }),
    {
      name: 'cpanel-auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)
