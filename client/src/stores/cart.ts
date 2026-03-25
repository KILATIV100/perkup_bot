import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  id: string // unique: productId + JSON(modifiers)
  productId?: number
  bundleId?: number
  name: string
  price: number
  quantity: number
  modifiers?: Record<string, string>
  locationId: number
}

interface CartState {
  items: CartItem[]
  locationId: number | null
  addItem: (item: Omit<CartItem, 'id'>) => void
  removeItem: (id: string) => void
  updateItem: (id: string, data: Partial<CartItem>) => void
  clearCart: () => void
  clearIfDifferentLocation: (locationId: number) => void
  getTotalPrice: () => number
  getTotalItems: () => number
}

function buildItemId(productId?: number, bundleId?: number, modifiers?: Record<string, string>): string {
  const base = productId ? `p${productId}` : `b${bundleId}`
  const mods = modifiers ? JSON.stringify(modifiers) : ''
  return `${base}${mods}`
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      locationId: null,

      addItem: (item) => {
        const id = buildItemId(item.productId, item.bundleId, item.modifiers)
        const items = get().items
        const existing = items.find(i => i.id === id)

        if (existing) {
          set({
            items: items.map(i =>
              i.id === id ? { ...i, quantity: i.quantity + item.quantity } : i
            ),
          })
        } else {
          set({
            items: [...items, { ...item, id }],
            locationId: item.locationId,
          })
        }

        // Haptic feedback
        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
      },

      removeItem: (id) => {
        set({ items: get().items.filter(i => i.id !== id) })
      },

      updateItem: (id, data) => {
        set({
          items: get().items.map(i => i.id === id ? { ...i, ...data } : i),
        })
      },

      clearCart: () => set({ items: [], locationId: null }),

      clearIfDifferentLocation: (locationId) => {
        if (get().locationId && get().locationId !== locationId) {
          set({ items: [], locationId: null })
        }
      },

      getTotalPrice: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      getTotalItems: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: 'perkup-cart',
    }
  )
)
