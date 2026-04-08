import { useAuthStore } from '../stores/auth'

export type Lang = 'uk' | 'en'

const translations: Record<string, Record<Lang, string>> = {
  // ─── Common ───
  'common.currency': { uk: 'грн', en: 'UAH' },
  'common.loading': { uk: 'Завантаження...', en: 'Loading...' },
  'common.error': { uk: 'Помилка', en: 'Error' },
  'common.save': { uk: 'Зберегти', en: 'Save' },
  'common.cancel': { uk: 'Скасувати', en: 'Cancel' },
  'common.delete': { uk: 'Видалити', en: 'Delete' },
  'common.close': { uk: 'Закрити', en: 'Close' },
  'common.back': { uk: 'Назад', en: 'Back' },
  'common.search': { uk: 'Пошук...', en: 'Search...' },
  'common.retry': { uk: 'Спробувати знову', en: 'Try again' },
  'common.loadFailed': { uk: 'Не вдалося завантажити', en: 'Failed to load' },
  'common.guest': { uk: 'Гість', en: 'Guest' },
  'common.open': { uk: 'Відчинено', en: 'Open' },
  'common.closed': { uk: 'Зачинено', en: 'Closed' },
  'common.copied': { uk: '✅ Скопійовано!', en: '✅ Copied!' },
  'common.m': { uk: 'м', en: 'm' },
  'common.km': { uk: 'км', en: 'km' },

  // ─── Login ───
  'login.signIn': { uk: 'Увійти', en: 'Sign in' },
  'login.guestBanner': { uk: 'Увійди через Telegram, щоб замовляти каву та отримувати бонуси!', en: 'Sign in with Telegram to order coffee and earn bonuses!' },
  'login.backToMenu': { uk: 'Повернутись до меню', en: 'Back to menu' },
  'login.terms': { uk: 'Натискаючи кнопку, ви погоджуєтесь з умовами використання', en: 'By clicking, you agree to the terms of use' },
  'login.authDesc': { uk: 'Авторизуйся, щоб переглядати меню, робити замовлення та отримувати бонуси', en: 'Sign in to browse the menu, place orders, and earn bonuses' },

  // ─── Nav ───
  'nav.menu': { uk: 'Меню', en: 'Menu' },
  'nav.ai': { uk: 'AI', en: 'AI' },
  'nav.funZone': { uk: 'Fun Zone', en: 'Fun Zone' },
  'nav.bonuses': { uk: 'Бонуси', en: 'Bonuses' },
  'nav.profile': { uk: 'Я', en: 'Me' },

  // ─── Header ───
  'header.chooseLocation': { uk: 'Оберіть точку', en: 'Choose location' },
  'header.chooseCafe': { uk: 'Оберіть кав\'ярню', en: 'Choose a coffee shop' },
  'header.opensAt': { uk: 'відкриємось о', en: 'opens at' },
  'header.busyMode': { uk: 'Запара', en: 'Busy' },
  'header.selfService': { uk: 'Самообслуговування', en: 'Self-service' },
  'header.toGo': { uk: 'To go', en: 'To go' },
  'header.familyCafe': { uk: 'Сімейне кафе', en: 'Family cafe' },

  // ─── Login ───
  'login.tagline': { uk: 'Кав\'ярня з бонусами та грою', en: 'Coffee shop with bonuses & games' },
  'login.telegram': { uk: 'Увійти через Telegram', en: 'Login with Telegram' },
  'login.authPrompt': { uk: 'Авторизуйся, щоб отримувати бали, подарунки та замовляти каву!', en: 'Sign in to earn points, get gifts, and order coffee!' },
  'login.loggingIn': { uk: 'Входимо...', en: 'Signing in...' },
  'login.error': { uk: 'Помилка авторизації', en: 'Authorization error' },
  'login.devLogin': { uk: 'Dev-вхід', en: 'Dev login' },

  // ─── Onboarding ───
  'onboarding.welcome': { uk: 'Ласкаво просимо!', en: 'Welcome!' },
  'onboarding.subtitle': { uk: 'Заверши швидкий онбординг, щоб отримати повний доступ.', en: 'Complete a quick onboarding to get full access.' },
  'onboarding.language': { uk: 'Мова', en: 'Language' },
  'onboarding.phone': { uk: 'Телефон (рекомендовано для передзамовлення)', en: 'Phone (recommended for preorders)' },
  'onboarding.birthday': { uk: 'Дата народження (опційно)', en: 'Birthday (optional)' },
  'onboarding.submit': { uk: 'Почати ☕', en: 'Get started ☕' },
  'onboarding.saving': { uk: 'Зберігаємо...', en: 'Saving...' },

  // ─── Menu ───
  'menu.title': { uk: 'Меню', en: 'Menu' },
  'menu.searchPlaceholder': { uk: 'Пошук по меню...', en: 'Search menu...' },
  'menu.add': { uk: 'Додати', en: 'Add' },
  'menu.goToCart': { uk: '🛒 Перейти в кошик', en: '🛒 Go to cart' },
  'menu.selfServiceBanner': { uk: '🏪 Точка самообслуговування. Меню можна переглядати в застосунку, але оформлення та оплата відбуваються тільки на місці.', en: '🏪 Self-service location. Browse the menu in the app, but ordering and payment are on-site only.' },
  'menu.preorderBanner': { uk: 'Передзамовлення: замовлення створюється в системі точки, а оплата проходить тільки на касі у бариста.', en: 'Preorder: the order is sent to the location system, payment is at the cashier only.' },
  'menu.preorderFormat': { uk: 'Передзамовлення для формату', en: 'Preorder for format' },
  'menu.all': { uk: 'Усі', en: 'All' },
  'menu.selectLocation': { uk: 'Оберіть точку у хедері, щоб побачити меню.', en: 'Select a location in the header to see the menu.' },
  'menu.category.coffee': { uk: '☕ Кава', en: '☕ Coffee' },
  'menu.category.cold': { uk: '🧊 Холодні напої', en: '🧊 Cold drinks' },
  'menu.category.food': { uk: '🍕 Їжа', en: '🍕 Food' },
  'menu.category.sweets': { uk: '🍰 Десерти', en: '🍰 Desserts' },
  'menu.category.addons': { uk: '➕ Добавки', en: '➕ Add-ons' },
  'menu.category.beans': { uk: '🌱 Зерно', en: '🌱 Beans' },
  'menu.category.merch': { uk: '🎁 Мерч', en: '🎁 Merch' },
  'menu.category.other': { uk: '📦 Інше', en: '📦 Other' },

  // ─── Cart ───
  'cart.title': { uk: '🛒 Кошик', en: '🛒 Cart' },
  'cart.empty': { uk: 'Кошик порожній', en: 'Cart is empty' },
  'cart.paymentNotice': { uk: 'Оплата проводиться на касі у бариста цієї точки. У застосунку ти лише створюєш передзамовлення.', en: 'Payment is made at the cashier. In the app you only create a preorder.' },
  'cart.checkout': { uk: 'Оформити', en: 'Checkout' },
  'cart.total': { uk: 'Разом', en: 'Total' },

  // ─── Checkout ───
  'checkout.title': { uk: 'Оформлення замовлення', en: 'Place order' },
  'checkout.phone': { uk: 'Номер телефону', en: 'Phone number' },
  'checkout.phonePlaceholder': { uk: 'Наприклад: +380501234567', en: 'e.g. +380501234567' },
  'checkout.phoneHint': { uk: 'Poster вимагає телефон клієнта для створення вхідного замовлення.', en: 'Poster requires a customer phone to create an incoming order.' },
  'checkout.comment': { uk: 'Коментар', en: 'Comment' },
  'checkout.commentPlaceholder': { uk: 'Наприклад: без цукру', en: 'e.g. no sugar' },
  'checkout.payment': { uk: 'Оплата', en: 'Payment' },
  'checkout.cashierOnly': { uk: 'Оплата проходить тільки на касі у бариста через POS цієї кав\'ярні. Спосіб оплати бариста вибере під час розрахунку.', en: 'Payment is at the cashier only, via the POS of this cafe. The barista will choose the payment method.' },
  'checkout.posterBonus': { uk: 'Бонуси за це замовлення будуть нараховані після оплати на касі. Списання бонусів у передзамовленні для Poster-точок поки вимкнене, щоб сума в застосунку не розходилась із POS.', en: 'Bonuses for this order will be credited after payment at the cashier. Bonus redemption for Poster locations is currently disabled to keep the app and POS amounts in sync.' },
  'checkout.submit': { uk: 'Замовити', en: 'Place order' },
  'checkout.submitting': { uk: 'Створюємо...', en: 'Creating...' },
  'checkout.selectLocation': { uk: 'Оберіть локацію', en: 'Select a location' },
  'checkout.emptyCart': { uk: 'Кошик порожній', en: 'Cart is empty' },
  'checkout.phoneRequired': { uk: 'Вкажи номер телефону для передзамовлення', en: 'Enter phone number for preorder' },

  // ─── Orders ───
  'order.title': { uk: 'Замовлення', en: 'Order' },
  'order.status': { uk: 'Статус', en: 'Status' },
  'order.qrCode': { uk: 'QR-код для видачі', en: 'QR code for pickup' },
  'order.loading': { uk: 'Ще формується...', en: 'Preparing...' },
  'order.cancel': { uk: 'Скасувати замовлення', en: 'Cancel order' },
  'order.cancelConfirm': { uk: 'Точно скасувати це замовлення?', en: 'Are you sure you want to cancel this order?' },
  'order.status.PENDING': { uk: '⏳ Очікує', en: '⏳ Pending' },
  'order.status.SENT_TO_POS': { uk: '📨 Передано в Poster', en: '📨 Sent to POS' },
  'order.status.ACCEPTED': { uk: '✅ Прийнято', en: '✅ Accepted' },
  'order.status.PREPARING': { uk: '👨‍🍳 Готується', en: '👨‍🍳 Preparing' },
  'order.status.READY': { uk: '☕ Готово', en: '☕ Ready' },
  'order.status.COMPLETED': { uk: '✅ Завершено', en: '✅ Completed' },
  'order.status.CANCELLED': { uk: '❌ Скасовано', en: '❌ Cancelled' },
  'order.status.UNASSIGNED': { uk: '📋 Без зміни', en: '📋 Unassigned' },

  // ─── Profile ───
  'profile.level': { uk: 'рівень', en: 'level' },
  'profile.points': { uk: 'балів', en: 'points' },
  'profile.pointsTo': { uk: 'Ще {n} балів до {level}', en: '{n} more points to {level}' },
  'profile.maxLevel': { uk: '🏆 Максимальний рівень досягнуто', en: '🏆 Maximum level reached' },
  'profile.almostNext': { uk: 'Майже на наступному рівні!', en: 'Almost at the next level!' },
  'profile.orders': { uk: '📦 Замовлень', en: '📦 Orders' },
  'profile.spins': { uk: '🎰 Спінів', en: '🎰 Spins' },
  'profile.vouchers': { uk: '🎟️ Ваучерів', en: '🎟️ Vouchers' },
  'profile.historyAndBonuses': { uk: '📜 Історія та бонуси', en: '📜 History & bonuses' },
  'profile.settings': { uk: '⚙️ Налаштування', en: '⚙️ Settings' },
  'profile.admin': { uk: '🛡️ Адмін панель', en: '🛡️ Admin panel' },
  'profile.referral': { uk: 'Запроси друга', en: 'Invite a friend' },
  'profile.referralDesc': { uk: 'Поділись посиланням — і ви обидва отримаєте бонусні бали!', en: 'Share the link — you both get bonus points!' },
  'profile.copyLink': { uk: '📋 Скопіювати посилання', en: '📋 Copy link' },
  'profile.logout': { uk: 'Вийти з акаунта', en: 'Sign out' },
  'profile.logoutConfirm': { uk: 'Точно вийти з акаунта?', en: 'Are you sure you want to sign out?' },
  'profile.logoutYes': { uk: 'Так, вийти', en: 'Yes, sign out' },

  // ─── Settings ───
  'settings.title': { uk: 'Налаштування', en: 'Settings' },
  'settings.language': { uk: 'Мова інтерфейсу', en: 'Interface language' },
  'settings.languageSaved': { uk: 'Мову збережено', en: 'Language saved' },
  'settings.notifications': { uk: 'Сповіщення', en: 'Notifications' },
  'settings.notifSpin': { uk: 'Колесо Фортуни', en: 'Fortune Wheel' },
  'settings.notifMorning': { uk: 'Ранкові рекомендації', en: 'Morning recommendations' },
  'settings.notifPromo': { uk: 'Акції та знижки', en: 'Promos & discounts' },
  'settings.account': { uk: 'Акаунт', en: 'Account' },
  'settings.phone': { uk: 'Телефон для передзамовлень', en: 'Phone for preorders' },
  'settings.name': { uk: 'Ім\'я', en: 'Name' },
  'settings.level': { uk: 'Рівень', en: 'Level' },
  'settings.pointsLabel': { uk: 'Бали', en: 'Points' },

  // ─── Bonuses ───
  'bonuses.title': { uk: '🎡 Бонуси', en: '🎡 Bonuses' },
  'bonuses.level': { uk: 'Рівень', en: 'Level' },
  'bonuses.balance': { uk: 'Баланс', en: 'Balance' },
  'bonuses.multiplier': { uk: 'Множник', en: 'Multiplier' },
  'bonuses.nextLevel': { uk: 'Наступний', en: 'Next' },
  'bonuses.orders': { uk: 'Замовлень', en: 'Orders' },
  'bonuses.spinTitle': { uk: '🎰 Колесо Фортуни', en: '🎰 Fortune Wheel' },
  'bonuses.spin': { uk: 'Крутити', en: 'Spin' },
  'bonuses.spinning': { uk: 'Крутиться...', en: 'Spinning...' },
  'bonuses.noSpins': { uk: 'Спінів немає', en: 'No spins' },
  'bonuses.congrats': { uk: '🎉 Вітаємо!', en: '🎉 Congratulations!' },
  'bonuses.youWon': { uk: 'Ви виграли:', en: 'You won:' },
  'bonuses.yourCode': { uk: 'Ваш код:', en: 'Your code:' },
  'bonuses.valid7days': { uk: 'Дійсний 7 днів', en: 'Valid for 7 days' },
  'bonuses.noLuck': { uk: 'Не пощастило цього разу 😅', en: 'No luck this time 😅' },
  'bonuses.great': { uk: 'Супер!', en: 'Great!' },
  'bonuses.activeVouchers': { uk: 'Активні ваучери', en: 'Active vouchers' },
  'bonuses.noVouchers': { uk: 'Ваучерів поки немає', en: 'No vouchers yet' },
  'bonuses.expiresAt': { uk: 'Дійсний до', en: 'Valid until' },
  'bonuses.history': { uk: 'Остання активність', en: 'Recent activity' },
  'bonuses.noHistory': { uk: 'Ще немає активності', en: 'No activity yet' },
  'bonuses.howItWorks': { uk: 'Як працюють бонуси?', en: 'How do bonuses work?' },
  'bonuses.faq1': { uk: 'Отримуй 1 бал за кожні 5 грн у чеку.', en: 'Earn 1 point for every 5 UAH spent.' },
  'bonuses.faq2': { uk: 'Оплачуй балами до 20% вартості (1 бал = 1 грн).', en: 'Redeem up to 20% of the order (1 point = 1 UAH).' },
  'bonuses.faq3': { uk: 'Кожні 5 замовлень — безкоштовний спін', en: 'Every 5 orders — free spin' },
  'bonuses.faq4': { uk: 'Рівні: Bronze → Silver → Gold → Platinum', en: 'Levels: Bronze → Silver → Gold → Platinum' },
  'bonuses.showBarista': { uk: 'Покажи бариста', en: 'Show the barista' },

  // ─── AI ───
  'ai.title': { uk: 'Бариста AI ✨', en: 'Barista AI ✨' },
  'ai.locationHint': { uk: 'Рекомендації з меню:', en: 'Menu recommendations:' },
  'ai.selectLocation': { uk: 'Оберіть локацію у хедері, щоб отримати персональні рекомендації.', en: 'Select a location in the header to get personalized recommendations.' },
  'ai.weather': { uk: '🌤️ Погода і напій', en: '🌤️ Weather & drink' },
  'ai.weatherNow': { uk: 'Зараз', en: 'Now' },
  'ai.mood': { uk: '🎭 Підбір за настроєм', en: '🎭 Pick by mood' },
  'ai.personal': { uk: '🔮 Персональна рекомендація', en: '🔮 Personal recommendation' },
  'ai.personalSubtitle': { uk: 'На основі твоїх попередніх замовлень', en: 'Based on your previous orders' },
  'ai.getRecommendation': { uk: 'Отримати рекомендацію', en: 'Get recommendation' },
  'ai.refreshRecommendation': { uk: 'Оновити рекомендацію', en: 'Refresh recommendation' },
  'ai.favorites': { uk: 'Твої улюблені:', en: 'Your favorites:' },
  'ai.cardOfDay': { uk: '🃏 Кава дня', en: '🃏 Coffee of the day' },
  'ai.coffeeFact': { uk: '💡 Факт про каву', en: '💡 Coffee fact' },
  'ai.dailyChallenge': { uk: '🎯 Щоденний виклик', en: '🎯 Daily challenge' },
  'ai.challengeDone': { uk: 'Виклик виконано сьогодні!', en: 'Challenge completed today!' },
  'ai.claimChallenge': { uk: 'Виконано! Отримати {n} балів', en: 'Done! Claim {n} points' },
  'ai.loginRequired': { uk: 'Увійдіть, щоб скористатися', en: 'Sign in to use this feature' },
  'ai.mood.happy': { uk: 'Радісний', en: 'Happy' },
  'ai.mood.sleepy': { uk: 'Сонний', en: 'Sleepy' },
  'ai.mood.stressed': { uk: 'Стрес', en: 'Stressed' },
  'ai.mood.cold': { uk: 'Замерз', en: 'Cold' },
  'ai.mood.thinking': { uk: 'Задумливий', en: 'Thinking' },
  'ai.mood.hot': { uk: 'Спека', en: 'Hot' },
  'ai.mood.calm': { uk: 'Спокій', en: 'Calm' },
  'ai.mood.energy': { uk: 'Енергія', en: 'Energy' },

  // ─── Fun ───
  'fun.title': { uk: '🎮 Fun Zone', en: '🎮 Fun Zone' },
  'fun.tab.game': { uk: 'Гра', en: 'Game' },
  'fun.tab.radio': { uk: 'Радіо', en: 'Radio' },
  'fun.tab.top': { uk: 'Топ', en: 'Top' },
  'fun.tab.rewards': { uk: 'Нагороди', en: 'Rewards' },
  'fun.newRecord': { uk: '🎉 Новий рекорд!', en: '🎉 New record!' },
  'fun.score': { uk: 'Рахунок', en: 'Score' },
  'fun.record': { uk: 'Рекорд', en: 'Record' },
  'fun.place': { uk: 'Місце', en: 'Place' },
  'fun.bonusPoints': { uk: 'бонусних балів', en: 'bonus points' },
  'fun.leaderboard': { uk: 'Таблиця лідерів', en: 'Leaderboard' },
  'fun.noPlayers': { uk: 'Ще ніхто не грав', en: 'No players yet' },
  'fun.gameRewards': { uk: 'Нагороди за гру', en: 'Game rewards' },
  'fun.gamesToday': { uk: 'Ігор сьогодні', en: 'Games today' },
  'fun.scoreNeeded': { uk: 'Набери {n} очків', en: 'Score {n} points' },
  'fun.claimed': { uk: 'Отримано', en: 'Claimed' },
  'fun.achieved': { uk: 'Досягнуто', en: 'Achieved' },
  'fun.nowPlaying': { uk: 'Грає зараз', en: 'Now playing' },
  'fun.noTracks': { uk: 'Наразі немає доступних треків', en: 'No tracks available' },

  // ─── Test Panel ───
  'test.title': { uk: 'Тест-режим (Owner)', en: 'Test mode (Owner)' },
  'test.reset': { uk: 'Скинути все та почати з початку', en: 'Reset everything & start over' },
  'test.resetConfirm': { uk: 'Впевнені? Усі бали, замовлення і бонуси будуть скинуті.', en: 'Are you sure? All points, orders and bonuses will be reset.' },
  'test.addOrders': { uk: 'Додати {n} замовлень', en: 'Add {n} orders' },
  'test.setPoints': { uk: 'Встановити {n} балів', en: 'Set {n} points' },
}

export function t(key: string, lang: Lang = 'uk', params?: Record<string, string | number>): string {
  const entry = translations[key]
  let text = entry?.[lang] ?? entry?.uk ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v))
    }
  }
  return text
}

export function useT(): (key: string, params?: Record<string, string | number>) => string {
  const lang = (useAuthStore.getState().user?.language as Lang) || 'uk'
  return (key: string, params?: Record<string, string | number>) => t(key, lang, params)
}

export function useLang(): Lang {
  return (useAuthStore.getState().user?.language as Lang) || 'uk'
}
