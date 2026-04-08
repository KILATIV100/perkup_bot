import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../stores/auth'
import { adminApi } from '../lib/api'

type Tab = 'dashboard' | 'users' | 'orders' | 'menu' | 'locations'

const ROLE_COLORS: Record<string, string> = {
  USER: 'bg-gray-100 text-gray-700',
  BARISTA: 'bg-blue-100 text-blue-700',
  ADMIN: 'bg-purple-100 text-purple-700',
  OWNER: 'bg-amber-100 text-amber-700',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-orange-100 text-orange-700',
  READY: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-green-200 text-green-800',
  CANCELLED: 'bg-red-100 text-red-700',
}

const CATEGORY_LABELS: Record<string, string> = {
  coffee: '☕ Кава', cold: '🧊 Холодні', food: '🥐 Їжа', sweets: '🍰 Солодощі',
  addons: '➕ Добавки', beans: '🌱 Зерно', merch: '🎁 Мерч', other: '📦 Інше',
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Дашборд', icon: '📊' },
  { id: 'orders', label: 'Замовлення', icon: '📋' },
  { id: 'users', label: 'Юзери', icon: '👥' },
  { id: 'menu', label: 'Меню', icon: '🍽️' },
  { id: 'locations', label: 'Локації', icon: '📍' },
]

export default function AdminPanel() {
  const { user, logout } = useAuthStore()
  const [tab, setTab] = useState<Tab>('dashboard')

  if (!user) return null

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-coffee-900 text-white flex flex-col shrink-0">
        <div className="p-5 border-b border-coffee-800">
          <div className="text-xl font-bold flex items-center gap-2">☕ PerkUp</div>
          <div className="text-coffee-400 text-xs mt-1">CPanel</div>
        </div>
        <nav className="flex-1 py-4">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`w-full text-left px-5 py-3 text-sm font-medium flex items-center gap-3 transition-colors ${
                tab === t.id ? 'bg-coffee-800 text-white' : 'text-coffee-300 hover:bg-coffee-800/50 hover:text-white'
              }`}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-coffee-800">
          <div className="text-sm font-medium">{user.firstName}</div>
          <div className="text-xs text-coffee-400">{user.role}</div>
          <button onClick={logout} className="mt-3 w-full text-xs text-coffee-400 hover:text-white transition-colors text-left">
            Вийти →
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-5xl mx-auto">
          {tab === 'dashboard' && <DashboardTab />}
          {tab === 'users' && <UsersTab isOwner={user.role === 'OWNER'} />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'menu' && <MenuTab />}
          {tab === 'locations' && <LocationsTab />}
        </div>
      </main>
    </div>
  )
}

// ─── DASHBOARD ──────────────────────────────────────────────────
function DashboardTab() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getDashboard().then(r => setStats(r.data.stats)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loader />
  if (!stats) return <div className="text-red-500">Помилка завантаження</div>

  const cards = [
    { label: 'Користувачі', value: stats.usersCount, icon: '👥', color: 'bg-blue-50 border-blue-200' },
    { label: 'Замовлень сьогодні', value: stats.ordersToday, icon: '📦', color: 'bg-green-50 border-green-200' },
    { label: 'Всього виконано', value: stats.ordersTotal, icon: '✅', color: 'bg-purple-50 border-purple-200' },
    { label: 'Виручка (грн)', value: stats.revenue.toFixed(0), icon: '💰', color: 'bg-amber-50 border-amber-200' },
    { label: 'Локацій', value: stats.locationsCount, icon: '📍', color: 'bg-pink-50 border-pink-200' },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Дашборд</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.label} className={`rounded-2xl border p-5 ${c.color}`}>
            <div className="text-3xl mb-2">{c.icon}</div>
            <div className="text-3xl font-bold text-gray-800">{c.value}</div>
            <div className="text-sm text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── USERS ──────────────────────────────────────────────────────
function UsersTab({ isOwner }: { isOwner: boolean }) {
  const [users, setUsers] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.getUsers({ page, role: roleFilter || undefined, search: search || undefined })
      setUsers(res.data.users)
      setTotal(res.data.total)
    } catch {}
    setLoading(false)
  }, [page, roleFilter, search])

  useEffect(() => { load() }, [load])

  const changeRole = async (id: number, role: string) => {
    try {
      await adminApi.setUserRole(id, role)
      setEditingId(null)
      load()
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error')
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Юзери</h2>

      <div className="flex gap-3 mb-4">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Пошук за ім'ям або @username..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-coffee-400" />
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-coffee-400">
          <option value="">Усі ролі</option>
          <option value="USER">User</option>
          <option value="BARISTA">Barista</option>
          <option value="ADMIN">Admin</option>
          <option value="OWNER">Owner</option>
        </select>
      </div>

      <p className="text-xs text-gray-400 mb-3">Знайдено: {total}</p>

      {loading ? <Loader /> : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Ім'я</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Username</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Бали</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Замов.</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Рівень</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Роль</th>
                {isOwner && <th className="text-center px-4 py-3 font-semibold text-gray-600">Дії</th>}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-800">{u.firstName} {u.lastName || ''}</td>
                  <td className="px-4 py-3 text-gray-500">{u.username ? `@${u.username}` : '—'}</td>
                  <td className="px-4 py-3 text-center">{u.points}</td>
                  <td className="px-4 py-3 text-center">{u.monthlyOrders}</td>
                  <td className="px-4 py-3 text-center">{u.level}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3 text-center">
                      {editingId === u.id ? (
                        <div className="flex gap-1 justify-center flex-wrap">
                          {['USER', 'BARISTA', 'ADMIN', 'OWNER'].map(r => (
                            <button key={r} onClick={() => changeRole(u.id, r)}
                              className={`px-2 py-1 rounded-lg text-xs font-medium ${r === u.role ? 'bg-coffee-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                              {r}
                            </button>
                          ))}
                          <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded-lg text-xs bg-red-50 text-red-500">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setEditingId(u.id)} className="text-xs text-coffee-600 font-medium hover:underline">Змінити</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50">← Назад</button>
          <span className="px-4 py-2 text-sm text-gray-600">Сторінка {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={users.length < 20}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50">Далі →</button>
        </div>
      )}
    </div>
  )
}

// ─── ORDERS ─────────────────────────────────────────────────────
function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.getOrders({ page, status: statusFilter || undefined })
      setOrders(res.data.orders)
      setTotal(res.data.total)
    } catch {}
    setLoading(false)
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Замовлення</h2>

      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        {['', 'PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap border transition-colors ${
              statusFilter === s ? 'bg-coffee-600 text-white border-coffee-600' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {s || 'Усі'}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400 mb-3">Всього: {total}</p>

      {loading ? <Loader /> : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">ID</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Клієнт</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Локація</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Позиції</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Сума</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Статус</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Дата</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-gray-800">#{o.id}</td>
                  <td className="px-4 py-3 text-gray-700">{o.user?.firstName || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{o.location?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{o.items?.map((i: any) => `${i.name} x${i.quantity}`).join(', ')}</td>
                  <td className="px-4 py-3 text-center font-medium">{Number(o.total).toFixed(0)} ₴</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[o.status] || 'bg-gray-100'}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-400">{new Date(o.createdAt).toLocaleString('uk')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50">← Назад</button>
          <span className="px-4 py-2 text-sm text-gray-600">Сторінка {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={orders.length < 20}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50">Далі →</button>
        </div>
      )}
    </div>
  )
}

// ─── MENU ────────────────────────────────────────────────────────
function MenuTab() {
  const [locations, setLocations] = useState<any[]>([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [categories, setCategories] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    adminApi.getLocations().then(r => {
      const locs = r.data.locations
      setLocations(locs)
      if (locs.length > 0) setSelectedSlug(locs[0].slug)
    })
  }, [])

  const loadMenu = useCallback(async () => {
    if (!selectedSlug) return
    setLoading(true)
    try {
      const res = await adminApi.getMenu(selectedSlug)
      setCategories(res.data.categories)
      setProducts(res.data.products)
      setSelectedCat(null)
    } catch {}
    setLoading(false)
  }, [selectedSlug])

  useEffect(() => { loadMenu() }, [loadMenu])

  const moveCat = async (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= categories.length) return
    const newCats = [...categories]
    const tmp = newCats[idx]
    newCats[idx] = newCats[newIdx]
    newCats[newIdx] = tmp
    setCategories(newCats)

    setSaving(true)
    try {
      await adminApi.reorderCategories(selectedSlug, newCats.map((c: any) => c.name))
      setMsg('✅ Порядок категорій збережено')
    } catch { setMsg('❌ Помилка') }
    setSaving(false)
    setTimeout(() => setMsg(''), 2000)
  }

  const catProducts = selectedCat ? products.filter(p => p.category === selectedCat).sort((a, b) => a.sortOrder - b.sortOrder) : []

  const moveProduct = async (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= catProducts.length) return
    const newProds = [...catProducts]
    const tmp = newProds[idx]
    newProds[idx] = newProds[newIdx]
    newProds[newIdx] = tmp

    const updatedAll = products.map(p => {
      const found = newProds.findIndex(np => np.id === p.id)
      if (found >= 0) return { ...p, sortOrder: found }
      return p
    })
    setProducts(updatedAll)

    setSaving(true)
    try {
      await adminApi.reorderProducts(selectedSlug, newProds.map((p: any) => p.id))
      setMsg('✅ Порядок позицій збережено')
    } catch { setMsg('❌ Помилка') }
    setSaving(false)
    setTimeout(() => setMsg(''), 2000)
  }

  const toggleAvailability = async (product: any) => {
    try {
      await adminApi.updateProduct(product.id, { isAvailable: !product.isAvailable })
      setProducts(ps => ps.map(p => p.id === product.id ? { ...p, isAvailable: !p.isAvailable } : p))
    } catch {}
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Меню</h2>

      <select value={selectedSlug} onChange={e => setSelectedSlug(e.target.value)}
        className="w-full max-w-xs border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white mb-4 focus:outline-none focus:ring-2 focus:ring-coffee-400">
        {locations.map(l => <option key={l.slug} value={l.slug}>{l.name}</option>)}
      </select>

      {msg && <div className="text-sm text-center text-amber-700 bg-amber-50 rounded-xl py-2 mb-4">{msg}</div>}

      {loading ? <Loader /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Categories */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-3">📂 Категорії</h3>
            <div className="space-y-1.5">
              {categories.map((cat, idx) => (
                <div key={cat.name} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors cursor-pointer ${
                  selectedCat === cat.name ? 'bg-coffee-50 border-coffee-300' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                }`} onClick={() => setSelectedCat(selectedCat === cat.name ? null : cat.name)}>
                  <div className="flex flex-col gap-0.5">
                    <button onClick={e => { e.stopPropagation(); moveCat(idx, -1) }} disabled={idx === 0 || saving}
                      className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-20">▲</button>
                    <button onClick={e => { e.stopPropagation(); moveCat(idx, 1) }} disabled={idx === categories.length - 1 || saving}
                      className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-20">▼</button>
                  </div>
                  <span className="flex-1 text-sm font-medium text-gray-700">{CATEGORY_LABELS[cat.name] || cat.name}</span>
                  <span className="text-xs text-gray-400">{cat.count} поз.</span>
                </div>
              ))}
            </div>
          </div>

          {/* Products */}
          {selectedCat && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-3">
                {CATEGORY_LABELS[selectedCat] || selectedCat} — позиції
              </h3>
              <div className="space-y-1.5">
                {catProducts.map((p, idx) => (
                  <div key={p.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                    p.isAvailable ? 'bg-gray-50 border-gray-100' : 'bg-red-50 border-red-100 opacity-60'
                  }`}>
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveProduct(idx, -1)} disabled={idx === 0 || saving}
                        className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-20">▲</button>
                      <button onClick={() => moveProduct(idx, 1)} disabled={idx === catProducts.length - 1 || saving}
                        className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-20">▼</button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                      <div className="text-xs text-gray-400">{Number(p.price).toFixed(0)} ₴</div>
                    </div>
                    <button onClick={() => toggleAvailability(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                        p.isAvailable ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}>
                      {p.isAvailable ? 'Увімк' : 'Вимк'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sync */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mt-4">
        <h3 className="font-semibold text-gray-700 mb-3">🔄 Синхронізація з Poster</h3>
        <div className="flex gap-3">
          <button onClick={() => { adminApi.syncAll(); setMsg('⏳ Синхронізація запущена') }} disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-coffee-600 text-white text-sm font-semibold disabled:opacity-50 hover:bg-coffee-700 transition-colors">
            Синк усіх
          </button>
          {selectedSlug && (
            <button onClick={async () => {
              try { await adminApi.syncLocation(selectedSlug); setMsg('✅ Синк ' + selectedSlug); loadMenu() }
              catch { setMsg('❌ Помилка синку') }
            }} disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-coffee-500 text-white text-sm font-semibold disabled:opacity-50 hover:bg-coffee-600 transition-colors">
              Синк {selectedSlug}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── LOCATIONS ──────────────────────────────────────────────────
function LocationsTab() {
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.getLocations().then(r => setLocations(r.data.locations)).finally(() => setLoading(false))
  }, [])

  const toggle = async (id: number, field: string, value: boolean) => {
    try {
      await adminApi.updateLocation(id, { [field]: value })
      setLocations(ls => ls.map(l => l.id === id ? { ...l, [field]: value } : l))
    } catch {}
  }

  if (loading) return <Loader />

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Локації</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {locations.map(loc => (
          <div key={loc.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-800 text-lg">{loc.name}</div>
                <div className="text-sm text-gray-400">{loc.slug} · {loc.address}</div>
              </div>
              <span className={`w-3 h-3 rounded-full ${loc.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>🍽️ {loc._count?.products || 0} позицій</span>
              <span>📦 {loc._count?.orders || 0} замовлень</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <ToggleBtn label="Замовлення" value={loc.allowOrders} onChange={v => toggle(loc.id, 'allowOrders', v)} />
              <ToggleBtn label="Busy Mode" value={loc.busyMode} onChange={v => toggle(loc.id, 'busyMode', v)} />
              <ToggleBtn label="Активна" value={loc.isActive} onChange={v => toggle(loc.id, 'isActive', v)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ToggleBtn({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors ${
        value ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'
      }`}>
      <span>{label}</span>
      <span>{value ? '✅' : '❌'}</span>
    </button>
  )
}

function Loader() {
  return <div className="text-center text-gray-400 py-8">Завантаження...</div>
}
