import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'https://api.perkup.com.ua'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('perkup_token')
  if (token) config.headers.Authorization = `Bearer ${token}`

  // Attach Telegram initData for auth requests
  const tg = window.Telegram?.WebApp
  if (tg?.initData) {
    config.headers['X-Telegram-Init-Data'] = tg.initData
  }

  return config
})

// Handle 401 - re-auth
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

// Auth
export const authApi = {
  loginWithTelegram: (initData: string) =>
    api.post('/api/auth/telegram', { initData }),
  getMe: () => api.get('/api/auth/me'),
  completeOnboarding: (data: {
    preferredLocationId?: number
    birthDate?: string
    language?: string
  }) => api.patch('/api/auth/onboarding', data),
}

// Locations
export const locationsApi = {
  getAll: (lat?: number, lng?: number) =>
    api.get('/api/locations', { params: { lat, lng } }),
  getBySlug: (slug: string) =>
    api.get(`/api/locations/${slug}`),
}

// Menu
export const menuApi = {
  getMenu: (locationSlug: string, params?: {
    category?: string
    search?: string
    tags?: string
  }) => api.get(`/api/menu/${locationSlug}`, { params }),
  getCategories: (locationSlug: string) =>
    api.get(`/api/menu/${locationSlug}/categories`),
}

// Orders
export const ordersApi = {
  create: (data: any) => api.post('/api/orders', data),
  getMyOrders: (page = 1) => api.get('/api/orders', { params: { page } }),
  getById: (id: number) => api.get(`/api/orders/${id}`),
  cancel: (id: number) => api.delete(`/api/orders/${id}`),
}

// Loyalty
export const loyaltyApi = {
  spin: (lat: number, lng: number) =>
    api.post('/api/loyalty/spin', { lat, lng }),
  redeem: () => api.post('/api/loyalty/redeem'),
  getTransactions: () => api.get('/api/loyalty/transactions'),
  getReferralLink: () => api.get('/api/loyalty/referral'),
}

// Media
export const mediaUrl = (fileId: string) =>
  `${BASE_URL}/api/media/${fileId}`
