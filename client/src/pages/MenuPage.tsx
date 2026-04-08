import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { menuApi } from '../lib/api'
import { useLocationStore } from '../stores/location'
import { useCartStore } from '../stores/cart'
import { useT } from '../lib/i18n'

type MenuProduct = {
  id: number
  name: string
  description?: string
  price: number
  category: string
}

type MenuCategory = {
  category: string
  products: MenuProduct[]
}

export default function MenuPage() {
  const navigate = useNavigate()
  const { activeLocation } = useLocationStore()
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const { addItem, getTotalItems, clearIfDifferentLocation } = useCartStore()
  const totalItems = getTotalItems()
  const t = useT()

  const CATEGORY_LABELS: Record<string, string> = {
    coffee: t('menu.category.coffee'),
    cold: t('menu.category.cold'),
    food: t('menu.category.food'),
    sweets: t('menu.category.sweets'),
    addons: t('menu.category.addons'),
    beans: t('menu.category.beans'),
    merch: t('menu.category.merch'),
    other: t('menu.category.other'),
  }

  const LOCATION_FORMAT_LABELS: Record<string, string> = {
    SELF_SERVICE: t('header.selfService'),
    TO_GO: t('header.toGo'),
    FAMILY_CAFE: t('header.familyCafe'),
  }

  const menuQuery = useQuery({
    queryKey: ['menu', activeLocation?.slug, search],
    enabled: !!activeLocation?.slug,
    queryFn: async () => {
      const res = await menuApi.getMenu(activeLocation!.slug, search ? { search } : undefined)
      return res.data
    },
  })

  const categories = useMemo<MenuCategory[]>(() => menuQuery.data?.categories || [], [menuQuery.data])
  const categoryTabs = useMemo<string[]>(() => categories.map((c) => c.category), [categories])
  const visibleCategories = useMemo<MenuCategory[]>(() => {
    if (selectedCategory === 'all') return categories
    return categories.filter((c) => c.category === selectedCategory)
  }, [categories, selectedCategory])

  if (!activeLocation) return <div className="p-4 text-gray-500">{t('menu.selectLocation')}</div>

  if (menuQuery.isLoading) {
    return <div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
  }

  if (menuQuery.isError) {
    return (
      <div className="p-4">
        <div className="text-red-600 mb-3">{t('common.loadFailed')}</div>
        <button className="px-4 py-2 rounded-xl bg-coffee-600 text-white" onClick={() => menuQuery.refetch()}>{t('common.retry')}</button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 pb-28">
      {activeLocation.format === 'SELF_SERVICE' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-3 text-sm">
          {t('menu.selfServiceBanner')}
        </div>
      )}

      {activeLocation.allowOrders && activeLocation.paymentFlow === 'CASHIER_ONLY' && (
        <div className="bg-coffee-100 border border-coffee-200 text-coffee-900 rounded-2xl p-3 text-sm">
          {t('menu.preorderFormat')} {LOCATION_FORMAT_LABELS[activeLocation.format || 'TO_GO'] || 'to go'}: {t('menu.preorderBanner')}
        </div>
      )}

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('menu.searchPlaceholder')} className="w-full border border-gray-200 rounded-xl px-3 py-2" />

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <button onClick={() => setSelectedCategory('all')} className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border ${selectedCategory === 'all' ? 'bg-coffee-600 text-white border-coffee-600' : 'bg-white border-gray-200 text-gray-700'}`}>{t('menu.all')}</button>
        {categoryTabs.map((cat) => (
          <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap border ${selectedCategory === cat ? 'bg-coffee-600 text-white border-coffee-600' : 'bg-white border-gray-200 text-gray-700'}`}>
            {CATEGORY_LABELS[cat] || cat}
          </button>
        ))}
      </div>

      {visibleCategories.map((section) => (
        <section key={section.category} className="space-y-2">
          <h2 className="text-lg font-bold text-coffee-700">{CATEGORY_LABELS[section.category] || section.category}</h2>
          {section.products.map((p) => (
            <article key={p.id} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900">{p.name}</div>
                  {p.description && <div className="text-sm text-gray-500 mt-1">{p.description}</div>}
                </div>
                <div className="text-right">
                  <div className="font-bold text-coffee-700 whitespace-nowrap">{Number(p.price).toFixed(0)} {t('common.currency')}</div>
                  {activeLocation.allowOrders && (
                    <button
                      onClick={() => {
                        clearIfDifferentLocation(activeLocation.id)
                        addItem({ productId: p.id, name: p.name, price: Number(p.price), quantity: 1, locationId: activeLocation.id })
                      }}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-coffee-600 text-white text-sm"
                    >
                      {t('menu.add')}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      ))}

      {activeLocation.allowOrders && totalItems > 0 && (
        <button onClick={() => navigate('/cart')} className="fixed left-3 right-3 bottom-20 z-40 px-4 py-3 rounded-2xl bg-coffee-700 text-white shadow-xl">
          {t('menu.goToCart')} ({totalItems})
        </button>
      )}
    </div>
  )
}
