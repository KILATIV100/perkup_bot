import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import TestPanel from '../components/TestPanel'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-2xl font-bold text-coffee-800">Профіль</h1>
      
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm text-center">
        <div className="w-20 h-20 bg-coffee-100 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl">
          👤
        </div>
        <div className="text-xl font-bold text-gray-800">{user?.firstName || 'Гість'}</div>
        <div className="text-sm text-gray-500 mt-1">Рівень: <span className="font-semibold text-coffee-600">{user?.level || 'BRONZE'}</span></div>
        <div className="text-sm text-gray-500 mt-1">Телефон: <span className="font-semibold text-coffee-600">{user?.phone || 'Не вказано'}</span></div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-2 shadow-sm">
        <button className="w-full text-left px-4 py-3 border-b border-gray-50 flex justify-between items-center">
          <span className="text-gray-700">📜 Історія замовлень</span>
          <span className="text-gray-300">›</span>
        </button>
        <button onClick={() => navigate('/settings')} className="w-full text-left px-4 py-3 flex justify-between items-center">
          <span className="text-gray-700">⚙️ Налаштування</span>
          <span className="text-gray-300">›</span>
        </button>
        {(user?.role === 'ADMIN' || user?.role === 'OWNER') && (
          <button onClick={() => navigate('/admin')} className="w-full text-left px-4 py-3 border-t border-gray-50 flex justify-between items-center">
            <span className="text-gray-700">🛡️ Адмін панель</span>
            <span className="text-gray-300">›</span>
          </button>
        )}
      </div>

      <TestPanel />

      <button onClick={logout} className="w-full py-3 text-red-500 font-semibold bg-red-50 rounded-xl mt-4 active:scale-95 transition-transform">
        Вийти з акаунта
      </button>
    </div>
  )
}
