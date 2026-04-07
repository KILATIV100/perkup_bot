import { useAuthStore } from '../stores/auth'

export default function BonusesPage() {
  const { user } = useAuthStore()

  return (
    <div className="p-4 pb-24">
      <h1 className="text-2xl font-bold mb-4 text-coffee-800">Лояльність</h1>
      
      <div className="bg-white p-5 rounded-2xl shadow-sm mb-4 border border-coffee-100 flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm">Ваш рівень</p>
          <p className="text-2xl font-bold text-coffee-600">{user?.level || 'Bronze'}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-sm">Баланс</p>
          <p className="text-2xl font-bold text-coffee-600">{user?.points || 0}</p>
        </div>
      </div>

      <div className="bg-coffee-50 p-6 rounded-2xl shadow-inner mb-4 text-center border border-coffee-200">
        <h2 className="text-xl font-bold mb-2">Колесо Фортуни 🎡</h2>
        <p className="text-sm text-gray-600 mb-5">Крути колесо та отримуй подарунки! 1 спін = кожні 5 замовлень.</p>
        <button className="bg-coffee-600 text-white px-8 py-3 rounded-full font-bold shadow-md active:scale-95 transition-transform">
          Крутити (Доступно: 0)
        </button>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="font-bold mb-3 text-gray-800">Як працюють бонуси?</h3>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-coffee-500 mt-0.5">•</span>
            <span>Отримуй <b>1 бал</b> за кожні 5 грн у чеку.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-coffee-500 mt-0.5">•</span>
            <span>Оплачуй балами до <b>20%</b> вартості (1 бал = 1 грн).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-coffee-500 mt-0.5">•</span>
            <span><b>Рівні:</b> Bronze (0-299), Silver (300-999), Gold (1000-2999), Platinum (3000+). Вищий рівень = швидше накопичення!</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
