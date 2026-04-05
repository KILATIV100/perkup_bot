import { useAuthStore } from '../stores/auth'

export default function ProfilePage() {
  const { user } = useAuthStore()

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-2xl font-bold text-coffee-700">Профіль</h1>
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="font-semibold">{user?.firstName || 'Користувач'}</div>
        <div className="text-sm text-gray-500 mt-1">Рівень: {user?.level || 'BRONZE'}</div>
        <div className="text-sm text-gray-500">Бали: {user?.points || 0}</div>
      </div>
    </div>
  )
}
