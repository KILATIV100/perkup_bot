import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocationStore } from '../stores/location'
import { useCartStore } from '../stores/cart'
import { useAuthStore } from '../stores/auth'
import { locationsApi } from '../lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useT } from '../lib/i18n'

export default function Header() {
  const [showPicker, setShowPicker] = useState(false)
  const { locations, activeLocation, setLocations, setActiveLocation } = useLocationStore()
  const cartCount = useCartStore(s => s.getTotalItems())
  const { isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const t = useT()

  const LOCATION_FORMAT_LABELS: Record<string, string> = {
    SELF_SERVICE: t('header.selfService'),
    TO_GO: t('header.toGo'),
    FAMILY_CAFE: t('header.familyCafe'),
  }

  useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      // Try to get user location
      let lat, lng
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch {}

      const res = await locationsApi.getAll(lat, lng)
      const locs = res.data.locations
      setLocations(locs)

      // Set first open location as default if none selected
      if (!activeLocation) {
        const open = locs.find((l: any) => l.isOpen) || locs[0]
        if (open) setActiveLocation(open)
      }

      return locs
    },
  })

  return (
    <>
      <header className="sticky top-0 z-40 bg-coffee-600 text-white px-4 py-3 flex items-center justify-between shadow-md">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">☕</span>
          <span className="font-bold text-lg text-coffee-100">PerkUp</span>
        </div>

        {/* Location picker */}
        <button
          onClick={() => setShowPicker(true)}
          className="flex items-center gap-1.5 bg-coffee-500 rounded-full px-3 py-1.5 text-sm font-medium"
        >
          <span>📍</span>
          <span className="max-w-[120px] truncate">
            {activeLocation?.name || t('header.chooseLocation')}
          </span>
          {activeLocation && (
            <span className={`w-2 h-2 rounded-full ${activeLocation.isOpen ? 'bg-green-400' : 'bg-red-400'}`} />
          )}
          <span className="text-coffee-200">▾</span>
        </button>

        {/* Cart / Login */}
        {isAuthenticated ? (
          <div className="relative">
            <button className="w-10 h-10 flex items-center justify-center" onClick={() => navigate('/cart')}>
              🛒
            </button>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-coffee-400 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold badge-bounce">
                {cartCount}
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={() => navigate('/login')}
            className="bg-white text-coffee-700 text-sm font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform"
          >
            {t('login.signIn')}
          </button>
        )}
      </header>

      {/* Location Picker Modal */}
      <AnimatePresence>
        {showPicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bottom-sheet-overlay"
              onClick={() => setShowPicker(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
            >
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
              <h2 className="text-xl font-bold text-coffee-600 mb-4">📍 {t('header.chooseCafe')}</h2>

              <div className="space-y-3">
                {locations.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => {
                      setActiveLocation(loc)
                      setShowPicker(false)
                      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged()
                    }}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                      activeLocation?.id === loc.id
                        ? 'border-coffee-500 bg-coffee-50'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{loc.name}</div>
                        <div className="text-sm text-gray-500 mt-0.5">{loc.address}</div>
                        {loc.format && (
                          <div className="text-xs text-gray-400 mt-1">{LOCATION_FORMAT_LABELS[loc.format] || loc.format}</div>
                        )}
                        {loc.distanceMeters && (
                          <div className="text-xs text-coffee-500 mt-1">
                            📍 {loc.distanceMeters < 1000
                              ? `${loc.distanceMeters} ${t('common.m')}` 
                              : `${(loc.distanceMeters / 1000).toFixed(1)} ${t('common.km')}`}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          loc.isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                        }`}>
                          {loc.isOpen ? `● ${t('common.open')}` : t('common.closed')}
                        </span>
                        {!loc.isOpen && loc.nextOpenTime && (
                          <span className="text-xs text-gray-400">{t('header.opensAt')} {loc.nextOpenTime}</span>
                        )}
                        {loc.busyMode && (
                          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                            🔴 {t('header.busyMode')}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
