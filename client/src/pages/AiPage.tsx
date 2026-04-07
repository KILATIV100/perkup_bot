export default function AiPage() {
  return (
    <div className="p-4 pb-24 space-y-4">
      <h1 className="text-2xl font-bold text-coffee-800">Бариста AI ✨</h1>

      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-center">
        <p className="text-blue-800 font-medium">Сьогодні +12°C ☁️</p>
        <p className="text-sm text-blue-600 mt-1">Ідеальний день для гарячого Флет Вайту з карамеллю.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-left active:scale-95 transition-transform">
          <span className="text-2xl block mb-2">🎴</span>
          <span className="font-bold text-gray-800 block">Карта дня</span>
          <span className="text-xs text-gray-500">Твоє передбачення</span>
        </button>
        <button className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-left active:scale-95 transition-transform">
          <span className="text-2xl block mb-2">💡</span>
          <span className="font-bold text-gray-800 block">Факт про каву</span>
          <span className="text-xs text-gray-500">Дізнайся нове</span>
        </button>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-gray-800">Щоденний челендж</h3>
          <span className="text-xs font-bold text-coffee-600 bg-coffee-50 px-2 py-1 rounded-full">+50 балів</span>
        </div>
        <p className="text-sm text-gray-600 mb-4">Спробуй будь-який напій з категорії "Авторські" до кінця дня.</p>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div className="bg-coffee-500 h-3 rounded-full w-[0%]"></div>
        </div>
        <p className="text-xs text-center text-gray-400 mt-2">0 / 1 виконано</p>
      </div>
    </div>
  )
}
