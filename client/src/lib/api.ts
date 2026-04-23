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
      // Lazy import to avoid circular dependency (api → auth → api)
      const { useAuthStore } = await import('../stores/auth')
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  loginWithTelegram: (initData: string) => api.post('/api/auth/telegram', { initData }),
  loginWithWidget: (data: any) => api.post('/api/auth/widget-login', data),
  devLogin: (telegramId?: number, firstName?: string) => api.post('/api/auth/dev-login', { telegramId, firstName }),
  getMe: () => api.get('/api/auth/me'),
  completeOnboarding: (data: { preferredLocationId?: number; birthDate?: string; phone?: string; language?: string }) =>
    api.patch('/api/auth/onboarding', data),
  updateSettings: (data: { language?: string; phone?: string; notifSpin?: boolean; notifWinback?: boolean; notifMorning?: boolean; notifPromo?: boolean }) =>
    api.patch('/api/auth/settings', data),
  testReset: () => api.post('/api/auth/test-reset'),
  testAddOrders: (count: number, locationSlug?: string) => api.post('/api/auth/test-add-orders', { count, locationSlug }),
  testSetPoints: (points: number) => api.post('/api/auth/test-set-points', { points }),
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
  getSpinPackages: () => api.get('/api/loyalty/spin-packages'),
  buySpins: (packageId: string) => api.post('/api/loyalty/buy-spins', { packageId }),
  redeem: () => api.post('/api/loyalty/redeem'),
  getTransactions: () => api.get('/api/loyalty/transactions'),
  getReferralLink: () => api.get('/api/loyalty/referral'),
  lookupVoucher: (code: string) => api.get(`/api/loyalty/voucher/${encodeURIComponent(code.toUpperCase())}`),
  redeemVoucher: (code: string) => api.post(`/api/loyalty/redeem/${encodeURIComponent(code.toUpperCase())}`),
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
  getStatus: () => api.get('/api/game/status'),
  finish: (data: { type: 'TIC_TAC_TOE' | 'PERKIE_CATCH' | 'BARISTA_RUSH' | 'MEMORY_COFFEE' | 'PERKIE_JUMP'; score: number }) =>
    api.post('/api/game/finish', data),
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

export const adminApi = {
  getDashboard: () => api.get('/api/admin/dashboard'),
  getUsers: (params?: { page?: number; role?: string; search?: string }) => api.get('/api/admin/users', { params }),
  setUserRole: (id: number, role: string) => api.patch(`/api/admin/users/${id}/role`, { role }),
  getOrders: (params?: { page?: number; status?: string; locationId?: number }) => api.get('/api/admin/orders', { params }),
  getLocations: () => api.get('/api/admin/locations'),
  updateLocation: (id: number, data: any) => api.patch(`/api/admin/locations/${id}`, data),
  setLocationPosterToken: (slug: string, token: string) => api.put(`/api/admin/locations/${encodeURIComponent(slug)}/poster-token`, { token }),
  getMenu: (locationSlug: string) => api.get(`/api/admin/menu/${locationSlug}`),
  createCategory: (locationSlug: string, name: string) => api.post(`/api/admin/menu/${locationSlug}/categories`, { name }),
  renameCategory: (locationSlug: string, oldName: string, name: string) => api.patch(`/api/admin/menu/${locationSlug}/categories`, { oldName, name }),
  deleteCategory: (locationSlug: string, categoryName: string, moveProductsTo?: string) => api.delete(`/api/admin/menu/${locationSlug}/categories/${encodeURIComponent(categoryName)}`, { data: moveProductsTo ? { moveProductsTo } : {} }),
  reorderCategories: (locationSlug: string, categories: string[]) => api.post(`/api/admin/menu/${locationSlug}/reorder-categories`, { categories }),
  createProduct: (locationSlug: string, data: any) => api.post(`/api/admin/menu/${locationSlug}/products`, data),
  reorderProducts: (locationSlug: string, productIds: number[]) => api.post(`/api/admin/menu/${locationSlug}/reorder-products`, { productIds }),
  updateProduct: (id: number, data: any) => api.patch(`/api/admin/products/${id}`, data),
  deleteProduct: (id: number) => api.delete(`/api/admin/products/${id}`),
  syncAll: () => api.post('/api/admin/sync'),
  syncLocation: (slug: string) => api.post(`/api/admin/sync/${slug}`),
  getMenuQrUrl: (locationSlug: string) => `${BASE_URL}/api/menu/${encodeURIComponent(locationSlug)}/qr.svg`,
  getPrintMenuUrl: (locationSlug: string) => `${BASE_URL}/api/menu/${encodeURIComponent(locationSlug)}/print`,
}
