import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { adminApi, loyaltyApi } from '../lib/api'

type Tab = 'dashboard' | 'users' | 'orders' | 'menu' | 'locations' | 'vouchers'

const ROLE_COLORS: Record<string, string> = {
  USER: 'bg-gray-100 text-gray-700',
  BARISTA: 'bg-blue-100 text-blue-700',
  ADMIN: 'bg-purple-100 text-purple-700',
  OWNER: 'bg-amber-100 text-amber-700',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  SENT_TO_POS: 'bg-indigo-100 text-indigo-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  PREPARING: 'bg-orange-100 text-orange-700',
  READY: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-green-200 text-green-800',
  CANCELLED: 'bg-red-100 text-red-700',
  UNASSIGNED: 'bg-gray-200 text-gray-700',
}

const CATEGORY_LABELS: Record<string, string> = {
  coffee: '☕ Кава', cold: '🧊 Холодні', food: '🥐 Їжа', sweets: '🍰 Солодощі',
  addons: '➕ Добавки', beans: '🌱 Зерно', merch: '🎁 Мерч', other: '📦 Інше',
}

const LOCATION_FORMAT_LABELS: Record<string, string> = {
  SELF_SERVICE: 'Самообслуговування',
  TO_GO: 'To go',
  FAMILY_CAFE: 'Сімейне кафе',
}

const POS_SYSTEM_LABELS: Record<string, string> = {
  NONE: 'Без POS інтеграції',
  POSTER: 'Poster',
}

const MENU_MANAGEMENT_LABELS: Record<string, string> = {
  LOCAL: 'Ручне меню',
  POSTER_SYNC: 'Синк з Poster',
}

export default function AdminPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isBarista = user?.role === 'BARISTA'
  const [tab, setTab] = useState<Tab>(isBarista ? 'vouchers' : 'dashboard')

  if (!user || !['BARISTA', 'ADMIN', 'OWNER'].includes(user.role)) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-600 font-semibold">⛔ Доступ заборонено</p>
        <button onClick={() => navigate('/profile')} className="mt-3 px-4 py-2 rounded-xl bg-coffee-600 text-white text-sm">Назад</button>
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: string }[] = isBarista
    ? [{ id: 'vouchers', label: 'Ваучери', icon: '🎟️' }]
    : [
        { id: 'dashboard', label: 'Дашборд', icon: '📊' },
        { id: 'orders', label: 'Замовлення', icon: '📋' },
        { id: 'users', label: 'Юзери', icon: '👥' },
        { id: 'menu', label: 'Меню', icon: '🍽️' },
        { id: 'locations', label: 'Локації', icon: '📍' },
        { id: 'vouchers', label: 'Ваучери', icon: '🎟️' },
      ]

  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/profile')} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-100 shadow-sm active:scale-95 transition-transform">←</button>
        <h1 className="text-2xl font-bold text-coffee-800">{isBarista ? 'Панель бариста' : 'Адмін панель'}</h1>
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
      {tab === 'vouchers' && <VouchersTab />}
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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`rounded-2xl border p-4 ${c.color}`}>
            <div className="text-2xl mb-1">{c.icon}</div>
            <div className="text-2xl font-bold text-gray-800">{c.value}</div>
            <div className="text-xs text-gray-500 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <a href="#/admin/vending"
        className="block rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm active:scale-[0.98] transition-transform">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🤖</span>
          <div>
            <div className="font-bold text-gray-800">Mark Mall • Автомат</div>
            <div className="text-xs text-gray-500 mt-0.5">Керування меню автомату</div>
          </div>
          <span className="ml-auto text-gray-400">→</span>
        </div>
      </a>
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
        {['', 'PENDING', 'SENT_TO_POS', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'UNASSIGNED'].map(s => (
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
  const [menuLocation, setMenuLocation] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [renameCategoryName, setRenameCategoryName] = useState('')
  const [moveCategoryProductsTo, setMoveCategoryProductsTo] = useState('')
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [creatingProduct, setCreatingProduct] = useState(false)
  const [productDraft, setProductDraft] = useState({
    name: '',
    price: '',
    category: '',
    description: '',
    ingredients: '',
    imageUrl: '',
    volume: '',
    calories: '',
    isAvailable: true,
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const resetProductDraft = (category = '') => {
    setProductDraft({
      name: '',
      price: '',
      category,
      description: '',
      ingredients: '',
      imageUrl: '',
      volume: '',
      calories: '',
      isAvailable: true,
    })
  }

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
      const nextCategories = res.data.categories || []
      setMenuLocation(res.data.location || null)
      setCategories(nextCategories)
      setCategories(res.data.categories)
      setProducts(res.data.products)
      setSelectedCat((current) => nextCategories.some((cat: any) => cat.name === current) ? current : nextCategories[0]?.name || null)
      setRenameCategoryName('')
      setMoveCategoryProductsTo('')
      setEditingProductId(null)
      setCreatingProduct(false)
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
  const selectedLocation = menuLocation || locations.find((location) => location.slug === selectedSlug)
  const isManualMenu = selectedLocation?.menuManagement === 'LOCAL'
  const isPosterMenu = selectedLocation?.posSystem === 'POSTER'
  const otherCategories = categories.filter((category) => category.name !== selectedCat)

  const showMessage = (value: string) => {
    setMsg(value)
    setTimeout(() => setMsg(''), 2400)
  }

  const beginCreateProduct = () => {
    setCreatingProduct(true)
    setEditingProductId(null)
    resetProductDraft(selectedCat || categories[0]?.name || '')
  }

  const startEditProduct = (product: any) => {
    setCreatingProduct(false)
    setEditingProductId(product.id)
    setProductDraft({
      name: product.name || '',
      price: String(Number(product.price).toFixed(0)),
      category: product.category || '',
      description: product.description || '',
      ingredients: product.ingredients || '',
      imageUrl: product.imageUrl || '',
      volume: product.volume || '',
      calories: product.calories ? String(product.calories) : '',
      isAvailable: Boolean(product.isAvailable),
    })
  }

  const cancelEditProduct = () => {
    setEditingProductId(null)
    setCreatingProduct(false)
    resetProductDraft(selectedCat || categories[0]?.name || '')
  }

  const saveProductChanges = async () => {
    if (!editingProductId && !creatingProduct) return

    const parsedPrice = Number(productDraft.price)
    if (!productDraft.name.trim() || !productDraft.category.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      showMessage('❌ Перевір назву, категорію та ціну')
      return
    }

    const payload = {
      name: productDraft.name.trim(),
      price: parsedPrice,
      category: productDraft.category.trim(),
      description: productDraft.description.trim() || undefined,
      ingredients: productDraft.ingredients.trim() || undefined,
      imageUrl: productDraft.imageUrl.trim() || undefined,
      volume: productDraft.volume.trim() || undefined,
      calories: productDraft.calories.trim() ? Number(productDraft.calories) : undefined,
      isAvailable: productDraft.isAvailable,
    }

    setSaving(true)
    try {
      if (editingProductId) {
        await adminApi.updateProduct(editingProductId, payload)
        showMessage('✅ Позицію оновлено')
      } else {
        await adminApi.createProduct(selectedSlug, payload)
        showMessage('✅ Позицію створено')
      }
      await loadMenu()
      setSelectedCat(payload.category)
      cancelEditProduct()
    } catch {
      showMessage('❌ Не вдалося зберегти позицію')
    }
    setSaving(false)
  }

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
      showMessage('✅ Порядок позицій збережено')
    } catch { showMessage('❌ Помилка') }
    setSaving(false)
  }

  const toggleAvailability = async (product: any) => {
    try {
      await adminApi.updateProduct(product.id, { isAvailable: !product.isAvailable })
      setProducts(ps => ps.map(p => p.id === product.id ? { ...p, isAvailable: !p.isAvailable } : p))
      if (editingProductId === product.id) {
        setProductDraft((current) => ({ ...current, isAvailable: !product.isAvailable }))
      }
    } catch {
      showMessage('❌ Не вдалося змінити доступність')
    }
  }

  const createCategory = async () => {
    if (!newCategoryName.trim()) return
    setSaving(true)
    try {
      await adminApi.createCategory(selectedSlug, newCategoryName.trim())
      setNewCategoryName('')
      await loadMenu()
      setSelectedCat(newCategoryName.trim())
      setRenameCategoryName(newCategoryName.trim())
      showMessage('✅ Категорію створено')
    } catch (e: any) {
      showMessage(e.response?.data?.error || '❌ Не вдалося створити категорію')
    }
    setSaving(false)
  }

  const renameCategory = async () => {
    if (!selectedCat || !renameCategoryName.trim()) return
    setSaving(true)
    try {
      await adminApi.renameCategory(selectedSlug, selectedCat, renameCategoryName.trim())
      await loadMenu()
      setSelectedCat(renameCategoryName.trim())
      showMessage('✅ Категорію перейменовано')
    } catch (e: any) {
      showMessage(e.response?.data?.error || '❌ Не вдалося перейменувати категорію')
    }
    setSaving(false)
  }

  const deleteCategory = async () => {
    if (!selectedCat) return
    if (catProducts.length > 0 && !moveCategoryProductsTo) {
      showMessage('❌ Обери куди перенести позиції перед видаленням категорії')
      return
    }
    setSaving(true)
    try {
      await adminApi.deleteCategory(selectedSlug, selectedCat, catProducts.length > 0 ? moveCategoryProductsTo : undefined)
      await loadMenu()
      showMessage('✅ Категорію видалено')
    } catch (e: any) {
      showMessage(e.response?.data?.error || '❌ Не вдалося видалити категорію')
    }
    setSaving(false)
  }

  const deleteProduct = async (product: any) => {
    if (!window.confirm(`Видалити позицію ${product.name}?`)) return
    setSaving(true)
    try {
      await adminApi.deleteProduct(product.id)
      await loadMenu()
      showMessage('✅ Позицію видалено')
    } catch (e: any) {
      showMessage(e.response?.data?.error || '❌ Не вдалося видалити позицію')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <select value={selectedSlug} onChange={e => setSelectedSlug(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
        {locations.map(l => <option key={l.slug} value={l.slug}>{l.name}</option>)}
      </select>

      {selectedLocation && (
        <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm text-sm text-gray-600 space-y-2">
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 rounded-full bg-coffee-50 text-coffee-700 text-xs font-medium">{LOCATION_FORMAT_LABELS[selectedLocation.format] || selectedLocation.format}</span>
            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">{POS_SYSTEM_LABELS[selectedLocation.posSystem] || selectedLocation.posSystem}</span>
            <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">{MENU_MANAGEMENT_LABELS[selectedLocation.menuManagement] || selectedLocation.menuManagement}</span>
          </div>
          <div className="text-xs text-gray-500">
            {isManualMenu
              ? 'Для цієї точки меню і ціни керуються вручну прямо з адмінки.'
              : 'Для цієї точки меню приходить з Poster. Локальні зміни можуть бути перезаписані синком.'}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <a href={adminApi.getMenuQrUrl(selectedSlug)} target="_blank" rel="noreferrer"
              className="px-3 py-2 rounded-xl bg-coffee-600 text-white text-xs font-semibold">
              QR SVG
            </a>
            <a href={adminApi.getPrintMenuUrl(selectedSlug)} target="_blank" rel="noreferrer"
              className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold">
              Друк меню
            </a>
          </div>
        </div>
      )}

      {loading ? <div className="text-center text-gray-400 py-4">...</div> : (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-semibold text-gray-700">📂 Категорії</h3>
              {isManualMenu && (
                <div className="flex gap-2 flex-1 justify-end">
                  <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Нова категорія"
                    className="flex-1 max-w-[220px] border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
                  <button onClick={createCategory} disabled={saving || !newCategoryName.trim()}
                    className="px-3 py-2 rounded-xl bg-coffee-600 text-white text-xs font-semibold disabled:opacity-50">
                    Додати
                  </button>
                </div>
              )}
            </div>

            {isManualMenu && selectedCat && (
              <div className="mb-3 rounded-2xl border border-coffee-100 bg-coffee-50 p-3 space-y-2">
                <div className="text-xs font-medium text-coffee-800">Редагування категорії: {selectedCat}</div>
                <div className="flex gap-2">
                  <input value={renameCategoryName} onChange={(e) => setRenameCategoryName(e.target.value)} placeholder="Нова назва категорії"
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
                  <button onClick={renameCategory} disabled={saving || !renameCategoryName.trim()}
                    className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 disabled:opacity-50">
                    Змінити
                  </button>
                </div>
                {catProducts.length > 0 && otherCategories.length > 0 && (
                  <select value={moveCategoryProductsTo} onChange={(e) => setMoveCategoryProductsTo(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
                    <option value="">Спочатку обери куди перенести позиції</option>
                    {otherCategories.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}
                  </select>
                )}
                <button onClick={deleteCategory} disabled={saving || (catProducts.length > 0 && !moveCategoryProductsTo)}
                  className="px-3 py-2 rounded-xl bg-red-50 text-red-700 text-xs font-semibold disabled:opacity-50">
                  Видалити категорію
                </button>
              </div>
            )}

            <div className="space-y-1">
              {categories.map((cat, idx) => (
                <div key={cat.name} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors cursor-pointer ${selectedCat === cat.name ? 'bg-coffee-50 border-coffee-300' : 'bg-gray-50 border-gray-100'}`}
                  onClick={() => {
                    setSelectedCat(selectedCat === cat.name ? null : cat.name)
                    setRenameCategoryName(cat.name)
                    setMoveCategoryProductsTo('')
                  }}>
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

          {selectedCat && (
            <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="font-semibold text-gray-700">
                  {CATEGORY_LABELS[selectedCat] || selectedCat} — позиції
                </h3>
                {isManualMenu && (
                  <button onClick={beginCreateProduct} disabled={saving}
                    className="px-3 py-2 rounded-xl bg-coffee-600 text-white text-xs font-semibold disabled:opacity-50">
                    Додати позицію
                  </button>
                )}
              </div>

              {isManualMenu && (creatingProduct || editingProductId !== null) && (
                <div className="mb-3 rounded-2xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                  <div className="text-xs font-medium text-gray-700">{editingProductId ? 'Редагування позиції' : 'Нова позиція'}</div>
                  <input value={productDraft.name} onChange={(e) => setProductDraft((current) => ({ ...current, name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" placeholder="Назва" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={productDraft.price} onChange={(e) => setProductDraft((current) => ({ ...current, price: e.target.value }))}
                      type="number" min="1" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" placeholder="Ціна" />
                    <input value={productDraft.category} onChange={(e) => setProductDraft((current) => ({ ...current, category: e.target.value }))}
                      list="admin-menu-categories" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" placeholder="Категорія" />
                  </div>
                  <textarea value={productDraft.description} onChange={(e) => setProductDraft((current) => ({ ...current, description: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" rows={2} placeholder="Опис" />
                  <input value={productDraft.ingredients} onChange={(e) => setProductDraft((current) => ({ ...current, ingredients: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" placeholder="Склад" />
                  <div className="grid grid-cols-3 gap-2">
                    <input value={productDraft.volume} onChange={(e) => setProductDraft((current) => ({ ...current, volume: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" placeholder="Обʼєм" />
                    <input value={productDraft.calories} onChange={(e) => setProductDraft((current) => ({ ...current, calories: e.target.value }))}
                      type="number" min="0" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" placeholder="Ккал" />
                    <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                      <input type="checkbox" checked={productDraft.isAvailable} onChange={(e) => setProductDraft((current) => ({ ...current, isAvailable: e.target.checked }))} />
                      Доступно
                    </label>
                  </div>
                  <input value={productDraft.imageUrl} onChange={(e) => setProductDraft((current) => ({ ...current, imageUrl: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" placeholder="URL зображення" />
                  <div className="flex gap-2">
                    <button onClick={saveProductChanges} disabled={saving}
                      className="px-3 py-2 rounded-xl bg-coffee-600 text-white text-xs font-semibold disabled:opacity-50">
                      {editingProductId ? 'Зберегти зміни' : 'Створити позицію'}
                    </button>
                    <button onClick={cancelEditProduct} disabled={saving}
                      className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-semibold text-gray-700 disabled:opacity-50">
                      Скасувати
                    </button>
                  </div>
                  <datalist id="admin-menu-categories">
                    {categories.map((category) => <option key={category.name} value={category.name} />)}
                  </datalist>
                </div>
              )}

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
                      {p.description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      {isManualMenu && (
                        <button onClick={() => startEditProduct(p)} className="px-2 py-1 rounded-lg text-xs font-medium bg-coffee-100 text-coffee-700">
                          Ред.
                        </button>
                      )}
                      <button onClick={() => toggleAvailability(p)}
                        className={`px-2 py-1 rounded-lg text-xs font-medium ${p.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {p.isAvailable ? 'Увімк' : 'Вимк'}
                      </button>
                      {isManualMenu && (
                        <button onClick={() => deleteProduct(p)} className="px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-700">
                          Вид.
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {catProducts.length === 0 && <div className="text-sm text-gray-400 py-3">У цій категорії ще немає позицій.</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {msg && <div className="text-sm text-center text-amber-700 bg-amber-50 rounded-xl py-2">{msg}</div>}

      <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-2">🔄 Синхронізація з Poster</h3>
        {isPosterMenu ? (
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
        ) : (
          <div className="text-sm text-gray-500">
            Для локального меню синхронізація не потрібна. Редагуй позиції та ціни вручну в списку вище.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── VOUCHERS (barista/admin) ────────────────────────────────────
function VouchersTab() {
  const [code, setCode] = useState('')
  const [voucher, setVoucher] = useState<any>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [redeeming, setRedeeming] = useState(false)

  const lookup = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setLoading(true)
    setError('')
    setSuccess('')
    setVoucher(null)
    try {
      const res = await loyaltyApi.lookupVoucher(trimmed)
      setVoucher(res.data.voucher)
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Помилка пошуку'
      setError(msg)
      if (e.response?.data?.voucher) setVoucher(e.response.data.voucher)
    }
    setLoading(false)
  }

  const redeem = async () => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setRedeeming(true)
    setError('')
    setSuccess('')
    try {
      const res = await loyaltyApi.redeemVoucher(trimmed)
      setSuccess(res.data.message || 'Ваучер списано!')
      setVoucher(null)
      setCode('')
    } catch (e: any) {
      setError(e.response?.data?.error || 'Помилка списання')
    }
    setRedeeming(false)
  }

  const PRIZE_EMOJI: Record<string, string> = {
    voucher: '🎫', discount: '🔥', points: '⭐', physical: '🎁', nothing: '😔',
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
        <h3 className="font-semibold text-gray-700">🎟️ Списання ваучера</h3>
        <p className="text-xs text-gray-400">Введіть код ваучера клієнта для перевірки та списання</p>

        <div className="flex gap-2">
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Код ваучера (напр. A1B2C3)"
            maxLength={10}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono tracking-widest text-center uppercase bg-white text-gray-800"
            onKeyDown={e => e.key === 'Enter' && lookup()}
          />
          <button
            onClick={lookup}
            disabled={loading || !code.trim()}
            className="px-4 py-2.5 rounded-xl bg-coffee-600 text-white text-sm font-semibold disabled:opacity-50 active:scale-95 transition-transform"
          >
            {loading ? '...' : '🔍'}
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            ✅ {success}
          </div>
        )}

        {voucher && (
          <div className="rounded-2xl bg-gradient-to-br from-coffee-50 to-amber-50 border border-coffee-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-2xl">{PRIZE_EMOJI[voucher.prizeType] || '🎫'}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                voucher.isUsed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}>
                {voucher.isUsed ? 'Використано' : 'Активний'}
              </span>
            </div>

            <div>
              <div className="text-lg font-bold text-gray-800">{voucher.prizeLabel}</div>
              <div className="text-xs text-gray-500 font-mono mt-0.5">Код: {voucher.code}</div>
            </div>

            {voucher.user && (
              <div className="rounded-xl bg-white/60 p-3 space-y-1 text-sm">
                <div className="text-gray-700">
                  👤 {voucher.user.firstName} {voucher.user.lastName || ''}
                </div>
                {voucher.user.phone && (
                  <div className="text-gray-500 text-xs">📱 {voucher.user.phone}</div>
                )}
                <div className="text-gray-500 text-xs">⭐ {voucher.user.points} балів</div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Створено: {new Date(voucher.createdAt).toLocaleString('uk')}</span>
              <span>До: {new Date(voucher.expiresAt).toLocaleDateString('uk')}</span>
            </div>

            {!voucher.isUsed && voucher.expiresAt > new Date().toISOString() && (
              <button
                onClick={redeem}
                disabled={redeeming}
                className="w-full py-3 rounded-xl bg-green-600 text-white font-bold text-sm active:scale-95 transition-transform disabled:opacity-50"
              >
                {redeeming ? 'Списуємо...' : '✅ Списати ваучер'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── LOCATIONS ──────────────────────────────────────────────────
function LocationsTab() {
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftHasPoster, setDraftHasPoster] = useState(false)
  const [draftPosterSubdomain, setDraftPosterSubdomain] = useState('')
  const [draftPosterAccount, setDraftPosterAccount] = useState('')
  const [draftPosterSpotId, setDraftPosterSpotId] = useState('')

  useEffect(() => {
    adminApi.getLocations().then(r => setLocations(r.data.locations)).finally(() => setLoading(false))
  }, [])

  const toggle = async (id: number, field: string, value: boolean) => {
    try {
      await adminApi.updateLocation(id, { [field]: value })
      setLocations(ls => ls.map(l => l.id === id ? { ...l, [field]: value } : l))
    } catch {}
  }

  const startEditConfig = (location: any) => {
    setEditingId(location.id)
    setDraftHasPoster(Boolean(location.hasPoster))
    setDraftPosterSubdomain(location.posterSubdomain || '')
    setDraftPosterAccount(location.posterAccount || '')
    setDraftPosterSpotId(location.posterSpotId ? String(location.posterSpotId) : '')
  }

  const cancelEditConfig = () => {
    setEditingId(null)
    setDraftHasPoster(false)
    setDraftPosterSubdomain('')
    setDraftPosterAccount('')
    setDraftPosterSpotId('')
  }

  const saveLocationConfig = async (locationId: number) => {
    try {
      const posterSpotId = draftPosterSpotId.trim() ? Number(draftPosterSpotId) : null
      await adminApi.updateLocation(locationId, {
        hasPoster: draftHasPoster,
        posterSubdomain: draftHasPoster ? draftPosterSubdomain.trim() : undefined,
        posterAccount: draftHasPoster ? draftPosterAccount.trim() : undefined,
        posterSpotId,
      })

      setLocations((current) => current.map((location) => location.id === locationId ? {
        ...location,
        hasPoster: draftHasPoster,
        posterSubdomain: draftHasPoster ? draftPosterSubdomain.trim() : null,
        posterAccount: draftHasPoster ? draftPosterAccount.trim() : null,
        posterSpotId,
        posSystem: draftHasPoster ? 'POSTER' : 'NONE',
        menuManagement: draftHasPoster ? 'POSTER_SYNC' : 'LOCAL',
      } : location))

      cancelEditConfig()
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

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-coffee-50 text-coffee-700">{LOCATION_FORMAT_LABELS[loc.format] || loc.format}</span>
            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">{POS_SYSTEM_LABELS[loc.posSystem] || loc.posSystem}</span>
            <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">{MENU_MANAGEMENT_LABELS[loc.menuManagement] || loc.menuManagement}</span>
          </div>

          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 space-y-2 text-xs text-gray-600">
            <div className="font-medium text-gray-700">POS налаштування</div>
            <div>Poster: {loc.hasPoster ? 'підключено' : 'вимкнено'}</div>
            <div>Subdomain: {loc.posterSubdomain || '—'}</div>
            <div>Account: {loc.posterAccount || '—'}</div>
            <div>Spot ID: {loc.posterSpotId || '—'}</div>

            {editingId === loc.id ? (
              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" checked={draftHasPoster} onChange={(e) => setDraftHasPoster(e.target.checked)} />
                  Використовувати Poster для цієї точки
                </label>
                <input value={draftPosterSubdomain} onChange={(e) => setDraftPosterSubdomain(e.target.value)} placeholder="Poster subdomain" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white" />
                <input value={draftPosterAccount} onChange={(e) => setDraftPosterAccount(e.target.value)} placeholder="Poster account" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white" />
                <input value={draftPosterSpotId} onChange={(e) => setDraftPosterSpotId(e.target.value)} type="number" min="1" placeholder="Poster spot ID" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs bg-white" />
                <div className="flex gap-2">
                  <button onClick={() => saveLocationConfig(loc.id)} className="px-3 py-2 rounded-lg bg-coffee-600 text-white text-xs font-medium">Зберегти</button>
                  <button onClick={cancelEditConfig} className="px-3 py-2 rounded-lg bg-gray-200 text-gray-700 text-xs font-medium">Скасувати</button>
                </div>
              </div>
            ) : (
              <button onClick={() => startEditConfig(loc)} className="px-3 py-2 rounded-lg bg-coffee-100 text-coffee-700 text-xs font-medium">
                Редагувати POS
              </button>
            )}
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
