import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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

export default function AdminPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('dashboard')

  if (!user || !['ADMIN', 'OWNER'].includes(user.role)) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-600 font-semibold">⛔ Доступ заборонено</p>
        <button onClick={() => navigate('/profile')} className="mt-3 px-4 py-2 rounded-xl bg-coffee-600 text-white text-sm">Назад</button>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Дашборд', icon: '📊' },
    { id: 'orders', label: 'Замовлення', icon: '📋' },
    { id: 'users', label: 'Юзери', icon: '👥' },
    { id: 'menu', label: 'Меню', icon: '🍽️' },
    { id: 'locations', label: 'Локації', icon: '📍' },
  ]

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/profile')} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-100 shadow-sm active:scale-95 transition-transform">←</button>
        <h1 className="text-2xl font-bold text-coffee-800">Адмін панель</h1>
        <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[user.role]}`}>{user.role}</span>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${tab === t.id ? 'bg-coffee-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardTab />}
      {tab === 'users' && <UsersTab isOwner={user.role === 'OWNER'} />}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'menu' && <MenuTab />}
      {tab === 'locations' && <LocationsTab />}
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

  if (loading) return <div className="text-center text-gray-400 py-8">Завантаження...</div>
  if (!stats) return <div className="text-red-500">Помилка завантаження</div>

  const cards = [
    { label: 'Користувачі', value: stats.usersCount, icon: '👥', color: 'bg-blue-50 border-blue-200' },
    { label: 'Замовлень сьогодні', value: stats.ordersToday, icon: '📦', color: 'bg-green-50 border-green-200' },
    { label: 'Всього виконано', value: stats.ordersTotal, icon: '✅', color: 'bg-purple-50 border-purple-200' },
    { label: 'Виручка (грн)', value: stats.revenue.toFixed(0), icon: '💰', color: 'bg-amber-50 border-amber-200' },
    { label: 'Локацій', value: stats.locationsCount, icon: '📍', color: 'bg-pink-50 border-pink-200' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map(c => (
        <div key={c.label} className={`rounded-2xl border p-4 ${c.color}`}>
          <div className="text-2xl mb-1">{c.icon}</div>
          <div className="text-2xl font-bold text-gray-800">{c.value}</div>
          <div className="text-xs text-gray-500 mt-1">{c.label}</div>
        </div>
      ))}
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
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Пошук..."
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" />
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-xl px-2 py-2 text-sm bg-white">
          <option value="">Усі</option>
          <option value="USER">User</option>
          <option value="BARISTA">Barista</option>
          <option value="ADMIN">Admin</option>
          <option value="OWNER">Owner</option>
        </select>
      </div>

      <p className="text-xs text-gray-400">Знайдено: {total}</p>

      {loading ? <div className="text-center text-gray-400 py-4">...</div> : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-gray-800">{u.firstName} {u.lastName || ''}</span>
                  {u.username && <span className="text-xs text-gray-400 ml-1">@{u.username}</span>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role]}`}>{u.role}</span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                <span>⭐ {u.points} б.</span>
                <span>📦 {u.monthlyOrders} зам.</span>
                <span>🏅 {u.level}</span>
              </div>

              {isOwner && editingId === u.id ? (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {['USER', 'BARISTA', 'ADMIN', 'OWNER'].map(r => (
                    <button key={r} onClick={() => changeRole(u.id, r)}
                      className={`px-2 py-1 rounded-lg text-xs font-medium ${r === u.role ? 'bg-coffee-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {r}
                    </button>
                  ))}
                  <button onClick={() => setEditingId(null)} className="px-2 py-1 rounded-lg text-xs bg-red-50 text-red-500">✕</button>
                </div>
              ) : isOwner ? (
                <button onClick={() => setEditingId(u.id)} className="mt-2 text-xs text-coffee-600 font-medium">Змінити роль</button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm disabled:opacity-40">←</button>
          <span className="px-3 py-1.5 text-sm text-gray-600">{page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={users.length < 20}
            className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm disabled:opacity-40">→</button>
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
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {['', 'PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'].map(s => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${statusFilter === s ? 'bg-coffee-600 text-white border-coffee-600' : 'bg-white border-gray-200 text-gray-600'}`}>
            {s || 'Усі'}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-400">Всього: {total}</p>

      {loading ? <div className="text-center text-gray-400 py-4">...</div> : (
        <div className="space-y-2">
          {orders.map(o => (
            <div key={o.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-800">#{o.id}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[o.status] || 'bg-gray-100'}`}>
                  {o.status}
                </span>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {o.user?.firstName} · {o.location?.name} · {Number(o.total).toFixed(0)} грн
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {o.items?.map((i: any) => `${i.name} x${i.quantity}`).join(', ')}
              </div>
              <div className="text-xs text-gray-300 mt-1">{new Date(o.createdAt).toLocaleString('uk')}</div>
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm disabled:opacity-40">←</button>
          <span className="px-3 py-1.5 text-sm text-gray-600">{page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={orders.length < 20}
            className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm disabled:opacity-40">→</button>
        </div>
      )}
    </div>
  )
}

// ─── MENU (with drag-reorder) ───────────────────────────────────
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
      await adminApi.reorderCategories(selectedSlug, newCats.map(c => c.name))
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

    // Update local state
    const updatedAll = products.map(p => {
      const found = newProds.findIndex(np => np.id === p.id)
      if (found >= 0) return { ...p, sortOrder: found }
      return p
    })
    setProducts(updatedAll)

    setSaving(true)
    try {
      await adminApi.reorderProducts(selectedSlug, newProds.map(p => p.id))
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
    <div className="space-y-3">
      {/* Location selector */}
      <select value={selectedSlug} onChange={e => setSelectedSlug(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
        {locations.map(l => <option key={l.slug} value={l.slug}>{l.name}</option>)}
      </select>

      {loading ? <div className="text-center text-gray-400 py-4">...</div> : (
        <>
          {/* Category reorder */}
          <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
            <h3 className="font-semibold text-gray-700 mb-2">📂 Категорії (перетягніть для зміни порядку)</h3>
            <div className="space-y-1">
              {categories.map((cat, idx) => (
                <div key={cat.name} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${selectedCat === cat.name ? 'bg-coffee-50 border-coffee-300' : 'bg-gray-50 border-gray-100'}`}
                  onClick={() => setSelectedCat(selectedCat === cat.name ? null : cat.name)}>
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

          {/* Products within selected category */}
          {selectedCat && (
            <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-2">
                {CATEGORY_LABELS[selectedCat] || selectedCat} — позиції
              </h3>
              <div className="space-y-1">
                {catProducts.map((p, idx) => (
                  <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${p.isAvailable ? 'bg-gray-50 border-gray-100' : 'bg-red-50 border-red-100 opacity-60'}`}>
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveProduct(idx, -1)} disabled={idx === 0 || saving}
                        className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-20">▲</button>
                      <button onClick={() => moveProduct(idx, 1)} disabled={idx === catProducts.length - 1 || saving}
                        className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-20">▼</button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                      <div className="text-xs text-gray-400">{Number(p.price).toFixed(0)} грн</div>
                    </div>
                    <button onClick={() => toggleAvailability(p)}
                      className={`px-2 py-1 rounded-lg text-xs font-medium ${p.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {p.isAvailable ? 'Увімк' : 'Вимк'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {msg && <div className="text-sm text-center text-amber-700 bg-amber-50 rounded-xl py-2">{msg}</div>}

      {/* Sync */}
      <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-2">🔄 Синхронізація з Poster</h3>
        <div className="flex gap-2">
          <button onClick={() => { adminApi.syncAll(); setMsg('⏳ Синхронізація запущена') }} disabled={saving}
            className="flex-1 py-2 rounded-xl bg-coffee-600 text-white text-sm font-semibold disabled:opacity-50">Синк усіх</button>
          {selectedSlug && (
            <button onClick={async () => {
              try { await adminApi.syncLocation(selectedSlug); setMsg('✅ Синк ' + selectedSlug); loadMenu() }
              catch { setMsg('❌ Помилка синку') }
            }} disabled={saving}
            className="flex-1 py-2 rounded-xl bg-coffee-500 text-white text-sm font-semibold disabled:opacity-50">Синк {selectedSlug}</button>
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

  if (loading) return <div className="text-center text-gray-400 py-4">...</div>

  return (
    <div className="space-y-3">
      {locations.map(loc => (
        <div key={loc.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-800">{loc.name}</div>
              <div className="text-xs text-gray-400">{loc.slug} · {loc.address}</div>
            </div>
            <span className={`w-3 h-3 rounded-full ${loc.isActive ? 'bg-green-400' : 'bg-red-400'}`} />
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>🍽️ {loc._count?.products || 0} поз.</span>
            <span>📦 {loc._count?.orders || 0} зам.</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <ToggleBtn label="Замовлення" value={loc.allowOrders} onChange={v => toggle(loc.id, 'allowOrders', v)} />
            <ToggleBtn label="Busy Mode" value={loc.busyMode} onChange={v => toggle(loc.id, 'busyMode', v)} />
            <ToggleBtn label="Активна" value={loc.isActive} onChange={v => toggle(loc.id, 'isActive', v)} />
          </div>
        </div>
      ))}
    </div>
  )
}

function ToggleBtn({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)}
      className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${value ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
      <span>{label}</span>
      <span>{value ? '✅' : '❌'}</span>
    </button>
  )
}
