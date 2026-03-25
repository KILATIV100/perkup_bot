import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Location {
  id: number
  slug: string
  name: string
  address: string
  lat: number
  lng: number
  allowOrders: boolean
  isOpen: boolean
  nextOpenTime?: string
  distanceMeters?: number
  busyMode: boolean
  busyModeUntil?: string
}

interface LocationState {
  locations: Location[]
  activeLocation: Location | null
  setLocations: (locations: Location[]) => void
  setActiveLocation: (location: Location) => void
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      locations: [],
      activeLocation: null,
      setLocations: (locations) => set({ locations }),
      setActiveLocation: (location) => set({ activeLocation: location }),
    }),
    {
      name: 'perkup-location',
      partialize: (state) => ({ activeLocation: state.activeLocation }),
    }
  )
)
