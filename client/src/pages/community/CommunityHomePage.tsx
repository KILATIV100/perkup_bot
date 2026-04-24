import { Link } from 'react-router-dom'

export default function CommunityHomePage() {
  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <h1 className="text-xl font-bold text-coffee-800 mb-1">Клуб PerkUp</h1>
        <p className="text-sm text-gray-600">Знайди людей для кави, гри або кіновечора.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/community/chat" className="bg-white border border-gray-100 rounded-xl p-4 font-semibold text-coffee-700">💬 Чат</Link>
        <Link to="/community/board-games" className="bg-white border border-gray-100 rounded-xl p-4 font-semibold text-coffee-700">🎲 Настільні ігри</Link>
        <Link to="/community/movie-nights" className="bg-white border border-gray-100 rounded-xl p-4 font-semibold text-coffee-700">🎬 Кіновечори</Link>
        <Link to="/community/movie-nights" className="bg-white border border-gray-100 rounded-xl p-4 font-semibold text-coffee-700">📅 Події</Link>
      </div>

      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-4">
        <div className="font-bold text-coffee-800 mb-2">Сьогодні</div>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>🎲 Catan о 18:30 · шукають 2 гравців</li>
          <li>🎬 Кіновечір о 19:00 · голосування за фільм</li>
          <li>☕ Вечір знайомств · п’ятниця</li>
        </ul>
      </div>
    </div>
  )
}
