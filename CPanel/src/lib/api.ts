import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'https://server-production-1a00.up.railway.app'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('cpanel_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cpanel_token')
      window.location.reload()
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  loginWithWidget: (data: any) => api.post('/api/auth/widget-login', data),
  getMe: () => api.get('/api/auth/me'),
}

export const adminApi = {
  getDashboard: () => api.get('/api/admin/dashboard'),
  getUsers: (params?: { page?: number; role?: string; search?: string }) => api.get('/api/admin/users', { params }),
  setUserRole: (id: number, role: string) => api.patch(`/api/admin/users/${id}/role`, { role }),
  getOrders: (params?: { page?: number; status?: string; locationId?: number }) => api.get('/api/admin/orders', { params }),
  getLocations: () => api.get('/api/admin/locations'),
  updateLocation: (id: number, data: any) => api.patch(`/api/admin/locations/${id}`, data),
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
  getCommunityMessages: (params?: { channel?: 'GENERAL' | 'BOARD_GAMES' | 'MOVIE_NIGHTS'; status?: string; limit?: number }) =>
    api.get('/api/admin/community/messages', { params }),
  hideCommunityMessage: (id: string) => api.patch(`/api/admin/community/messages/${id}/hide`),
  getCommunityBoardGames: () => api.get('/api/admin/community/board-games'),
  getCommunityEvents: () => api.get('/api/admin/community/events'),
}
