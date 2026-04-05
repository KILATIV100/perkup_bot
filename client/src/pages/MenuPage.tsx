import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { menuApi, ordersApi } from '../lib/api'
import { useLocationStore } from '../stores/location'
import { useCartStore } from '../stores/cart'

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
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('card')
  const [checkoutMsg, setCheckoutMsg] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  const { items, addItem, clearCart, getTotalItems, getTotalPrice, clearIfDifferentLocation } = useCartStore()
  const totalItems = getTotalItems()
  const totalPrice = getTotalPrice()

  const menuQuery = useQuery({
    queryKey: ['menu', activeLocation?.slug, search],
    enabled: !!activeLocation?.slug,
    queryFn: async () => {
      const res = await menuApi.getMenu(activeLocation!.slug, search ? { search } : undefined)
      return res.data
    },
  })

  const categories = useMemo<MenuCategory[]>(() => menuQuery.data?.categories || [], [menuQuery.data])

  const checkout = async () => {
    if (!activeLocation) return
    if (!items.length) return

    setCheckoutLoading(true)
    setCheckoutMsg('')
    try {
      const orderRes = await ordersApi.create({
        locationId: activeLocation.id,
        paymentMethod,
        items: items.map((i) => ({
          productId: i.productId,
          bundleId: i.bundleId,
          quantity: i.quantity,
          modifiers: i.modifiers,
        })),
      })

      let finalOrder = orderRes.data.order
      if (paymentMethod === 'card') {
        const payRes = await ordersApi.pay(orderRes.data.order.id, `manual_${Date.now()}`)
        finalOrder = payRes.data.order
      }

      clearCart()
      setCheckoutMsg(`✅ Замовлення #${finalOrder.id} створено (${finalOrder.status})`)
    } catch (e: any) {
      setCheckoutMsg(e?.response?.data?.error || 'Помилка створення замовлення')
    } finally {
      setCheckoutLoading(false)
    }
  }

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
    <div className="p-4 space-y-4 pb-28">
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
                <div className="text-right">
                  <div className="font-bold text-coffee-700 whitespace-nowrap">{Number(p.price).toFixed(0)} грн</div>
                  {activeLocation.allowOrders && (
                    <button
                      onClick={() => {
                        clearIfDifferentLocation(activeLocation.id)
                        addItem({
                          productId: p.id,
                          name: p.name,
                          price: Number(p.price),
                          quantity: 1,
                          locationId: activeLocation.id,
                        })
                      }}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-coffee-600 text-white text-sm"
                    >
                      Додати
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      ))}

      {checkoutMsg && <div className="text-sm text-gray-700 bg-white rounded-xl p-3 border">{checkoutMsg}</div>}

      {activeLocation.allowOrders && totalItems > 0 && (
        <div className="fixed left-3 right-3 bottom-20 z-40 bg-white border border-gray-200 rounded-2xl p-3 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>У кошику: {totalItems}</span>
            <span className="font-bold">{totalPrice.toFixed(0)} грн</span>
          </div>
          <div className="flex gap-2">
            <button className={`px-3 py-1.5 rounded-lg border ${paymentMethod === 'card' ? 'bg-coffee-600 text-white' : 'bg-white'}`} onClick={() => setPaymentMethod('card')}>Картка</button>
            <button className={`px-3 py-1.5 rounded-lg border ${paymentMethod === 'cash' ? 'bg-coffee-600 text-white' : 'bg-white'}`} onClick={() => setPaymentMethod('cash')}>Готівка</button>
          </div>
          <button disabled={checkoutLoading} onClick={checkout} className="w-full px-4 py-2 rounded-xl bg-coffee-700 text-white disabled:opacity-60">
            {checkoutLoading ? 'Обробка...' : 'Замовити та оплатити'}
          </button>
        </div>
      )}
    </div>
  )
}
