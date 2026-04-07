import { NavLink } from 'react-router-dom'
import clsx from 'clsx'

const tabs = [
  { path: '/menu',    emoji: '☕', label: 'Меню' },
  { path: '/radio',   emoji: '🎵', label: 'Радіо' },
  { path: '/ai',      emoji: '✨', label: 'AI' },
  { path: '/bonuses', emoji: '🎡', label: 'Бонуси' },
  { path: '/profile', emoji: '👤', label: 'Я' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 shadow-lg"
         style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-16">
        {tabs.map(tab => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) => clsx(
              'flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative transition-colors',
              isActive ? 'text-coffee-600' : 'text-gray-400'
            )}
          >
            {({ isActive }) => (
              <>
                <span className="text-2xl leading-none">{tab.emoji}</span>
                <span className={clsx('text-[10px] font-medium', isActive ? 'text-coffee-600' : 'text-gray-400')}>
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-coffee-600 rounded-full" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
