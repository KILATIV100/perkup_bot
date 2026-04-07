import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'https://server-production-1a00.up.railway.app'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('perkup_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  const tg = window.Telegram?.WebApp
  if (tg?.initData) config.headers['X-Telegram-Init-Data'] = tg.initData
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('perkup_token')
      window.location.reload()
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  loginWithTelegram: (initData: string) => api.post('/api/auth/telegram', { initData }),
  devLogin: (telegramId?: number, firstName?: string) => api.post('/api/auth/dev-login', { telegramId, firstName }),
  getMe: () => api.get('/api/auth/me'),
  completeOnboarding: (data: { preferredLocationId?: number; birthDate?: string; language?: string }) =>
    api.patch('/api/auth/onboarding', data),
}

export const locationsApi = {
  getAll: (lat?: number, lng?: number) => api.get('/api/locations', { params: { lat, lng } }),
  getBySlug: (slug: string) => api.get(`/api/locations/${slug}`),
}

export const menuApi = {
  getMenu: (locationSlug: string, params?: { category?: string; search?: string; tags?: string }) =>
    api.get(`/api/menu/${locationSlug}`, { params }),
  getCategories: (locationSlug: string) => api.get(`/api/menu/${locationSlug}/categories`),
}

export const ordersApi = {
  create: (data: any) => api.post('/api/orders', data),
  pay: (id: number, paymentId: string) => api.post(`/api/orders/${id}/pay`, { paymentId }),
  getMyOrders: (page = 1) => api.get('/api/orders', { params: { page } }),
  getById: (id: number) => api.get(`/api/orders/${id}`),
  cancel: (id: number) => api.delete(`/api/orders/${id}`),
}

export const loyaltyApi = {
  getStatus: () => api.get('/api/loyalty/status'),
  getPrizes: () => api.get('/api/loyalty/prizes'),
  spin: () => api.post('/api/loyalty/spin'),
  redeem: () => api.post('/api/loyalty/redeem'),
  getTransactions: () => api.get('/api/loyalty/transactions'),
  getReferralLink: () => api.get('/api/loyalty/referral'),
}

export const mediaUrl = (fileId: string) => `${BASE_URL}/api/media/${fileId}`

export const aiApi = {
  weatherMenu: (locationSlug?: string) => api.get('/api/ai/weather-menu', { params: { locationSlug } }),
  cardOfDay: () => api.get('/api/ai/card-of-day'),
  coffeeFact: () => api.get('/api/ai/coffee-fact'),
  moodMenu: (mood: string, locationSlug?: string) => api.post('/api/ai/mood-menu', { mood, locationSlug }),
  personalRecommend: (locationSlug?: string) => api.get('/api/ai/personal-recommend', { params: { locationSlug } }),
  dailyChallenge: () => api.get('/api/ai/daily-challenge'),
  claimChallenge: () => api.post('/api/ai/daily-challenge/claim'),
}

export const gameApi = {
  submitScore: (score: number) => api.post('/api/game/coffee-jump/score', { score }),
  getLeaderboard: () => api.get('/api/game/coffee-jump/leaderboard'),
  getMyStats: () => api.get('/api/game/coffee-jump/my-stats'),
}

export const radioApi = {
  playlist: () => api.get('/api/radio/playlist'),
  now: () => api.get('/api/radio/now'),
  addTrack: (data: { fileId: string; title: string; url: string; artist?: string; duration?: number; genre?: string }) =>
    api.post('/api/radio/add-track', data),
  setGenre: (genre: string) => api.post('/api/radio/user-genre', { genre }),
}
