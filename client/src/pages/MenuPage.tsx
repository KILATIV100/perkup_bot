import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { menuApi } from '../lib/api'
import { useLocationStore } from '../stores/location'

type MenuProduct = {
  id: number
  name: string
  description?: string
  price: number
  category: string
  tags?: string[]
  allergens?: string[]
}

type MenuCategory = {
  category: string
  products: MenuProduct[]
}

export default function MenuPage() {
  const { activeLocation } = useLocationStore()
  const [search, setSearch] = useState('')

  const menuQuery = useQuery({
    queryKey: ['menu', activeLocation?.slug, search],
    enabled: !!activeLocation?.slug,
    queryFn: async () => {
      const res = await menuApi.getMenu(activeLocation!.slug, search ? { search } : undefined)
      return res.data
    },
  })

  const categories = useMemo<MenuCategory[]>(() => menuQuery.data?.categories || [], [menuQuery.data])

  if (!activeLocation) {
    return <div className="p-4 text-gray-500">Оберіть точку у хедері, щоб переглянути меню.</div>
  }

  if (menuQuery.isLoading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
    )
  }

  if (menuQuery.isError) {
    return (
      <div className="p-4">
        <div className="text-red-600 mb-3">Не вдалося завантажити меню.</div>
        <button
          className="px-4 py-2 rounded-xl bg-coffee-600 text-white"
          onClick={() => menuQuery.refetch()}
        >
          Спробувати знову
        </button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {!activeLocation.allowOrders && activeLocation.slug === 'mark-mall' && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-3 text-sm">
          🏪 Самообслуговування — обери позиції та підійди до каси.
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Пошук по меню..."
        className="w-full border border-gray-200 rounded-xl px-3 py-2"
      />

      {categories.map((section) => (
        <section key={section.category} className="space-y-2">
          <h2 className="text-lg font-bold text-coffee-700 capitalize">{section.category}</h2>
          {section.products.map((p) => (
            <article key={p.id} className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900">{p.name}</div>
                  {p.description && <div className="text-sm text-gray-500 mt-1">{p.description}</div>}
                </div>
                <div className="font-bold text-coffee-700 whitespace-nowrap">{Number(p.price).toFixed(0)} грн</div>
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  )
}
