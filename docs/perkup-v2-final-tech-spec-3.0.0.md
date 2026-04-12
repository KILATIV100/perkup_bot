# ☕ PerkUp v2.0 — Фінальне технічне завдання

**Версія:** 3.1.0 (актуалізовано)  
**Дата:** Квітень 2026  
**Точки:** Mark Mall (самообслуговування), ЖК Крона Парк 2 (to-go), Парк Приозерний (сімейне кафе)

---

## 1) Мета документа

Цей документ фіксує актуальний стан реалізації PerkUp v2.0 — гейміфікованої екосистеми лояльності для мережі кав'ярень. Кожна фіча має позначку статусу: ✅ реалізовано, 🔶 частково, ❌ не реалізовано.

---

## 2) Архітектура та техстек

| Компонент | Технологія |
|-----------|-----------|
| Backend | Node.js + Fastify v4 + TypeScript |
| База даних | PostgreSQL + Prisma ORM |
| Frontend (Mini App) | React 18 + Vite + Tailwind CSS + Zustand |
| Admin Panel (CPanel) | React 18 + Vite + Tailwind CSS (окремий Vite-проект) |
| Telegram Bot | grammY (long polling) |
| Черги/воркери | BullMQ + Redis |
| Кеш/lock/rate-limit | Redis (два з'єднання: `redis` для BullMQ, `redisCache` для HTTP) |
| POS-інтеграція | Poster API v3 (окремі акаунти Крона / Приозерний) |
| AI | Anthropic Claude 3.5 Haiku |
| Погода | OpenWeatherMap API |
| Медіа | Telegram File Storage (проксі через API) |
| Роутинг | HashRouter (client), SPA (CPanel) |
| i18n | Власний словник uk/en через `useT()` hook |
| Деплой | Railway (Nixpacks) — server + bot як окремі сервіси |
| Клієнт хостинг | CPanel (ручний upload dist → public_html) |
| Оплата | ❌ WayForPay не підключено — лише CASHIER_ONLY |
| Realtime | ❌ Socket.io не використовується — REST polling (5 сек) |
| Принтери | ❌ ESC/POS не реалізовано — поля в schema є, коду немає |

---

## 3) П'ять обов'язкових правил

1. Баланс балів завжди консистентний; idempotency key на кожну транзакцію.
2. Замовлення не губляться: при недоступності Poster — retry queue (BullMQ).
3. Меню між локаціями не змішується: `locationId` обов'язковий скрізь.
4. Геозона/бізнес-логіка валідуються тільки на бекенді.
5. `BOT_TOKEN` ніколи не потрапляє на клієнт; медіа лише через проксі `/api/media/:fileId`.

---

## 4) Автентифікація

| Фіча | Статус |
|-------|--------|
| Telegram WebApp initData (HMAC-SHA256) | ✅ |
| Telegram Login Widget (SHA256) | ✅ |
| Dev-login (за `ALLOW_DEV_LOGIN=true`) | ✅ |
| JWT токени (7 днів, `@fastify/jwt`) | ✅ |
| `GET /api/auth/me` — поточний юзер | ✅ |
| `PATCH /api/auth/onboarding` — мова, телефон, день народження, локація | ✅ |
| `PATCH /api/auth/settings` — окремий endpoint | ❌ клієнт викликає, але endpoint не створено |
| Гостьовий режим (меню без авторизації) | ✅ |
| Rate limit (100 req/min, Redis, `skipOnError`) | ✅ |
| CORS (hardcoded perkup.com.ua + env) | ✅ |

---

## 5) Локації

| Фіча | Статус |
|-------|--------|
| `GET /api/locations` — усі локації з відстанню, годинами, форматом | ✅ |
| `GET /api/locations/:slug` — одна локація | ✅ |
| Open/closed детекція (Kyiv timezone UTC+2) | ✅ |
| Гео-сортування за відстанню | ✅ |
| Профілі локацій (format, POS, menu management, payment flow) | ✅ |
| Mark Mall: `SELF_SERVICE`, `LOCAL` меню, `NONE` POS | ✅ |
| Крона: `TO_GO`, `POSTER_SYNC`, `POSTER` POS | ✅ |
| Приозерний: `FAMILY_CAFE`, `POSTER_SYNC`, `POSTER` POS | ✅ |
| Busy mode (прапор + час закінчення) | ✅ schema + admin UI |

---

## 6) Меню

| Фіча | Статус |
|-------|--------|
| `GET /api/menu/:slug` — повне меню з фільтрами (category, search, tags) | ✅ |
| `GET /api/menu/:slug/categories` — список категорій | ✅ |
| `GET /api/menu/:slug/qr.svg` — QR-код SVG | ✅ |
| `GET /api/menu/:slug/print` — HTML printable меню | ✅ |
| Кешування в Redis (30 хв, `redisCache`) | ✅ |
| Popular products (top 3 за ordersCount) | ✅ |
| Комбо-набори (Bundle) | ✅ |
| Skeleton loader | ✅ |
| Sticky категорії + пошук | ✅ |
| Модифікатори (JSON поле) | ✅ schema + API |
| Admin: CRUD продуктів (LOCAL локації) | ✅ |
| Admin: керування категоріями (create/rename/delete/reorder) | ✅ |
| Poster sync: автоматичне оновлення кожні 30 хв | ✅ |

---

## 7) Замовлення

| Фіча | Статус |
|-------|--------|
| `POST /api/orders` — створення (products + bundles, comment, points) | ✅ |
| `GET /api/orders` — мої замовлення (last 20) | ✅ |
| `GET /api/orders/:id` — деталі замовлення | ✅ |
| `DELETE /api/orders/:id` — скасування + повернення балів | ✅ |
| `PATCH /api/orders/:id/status` — бариста змінює статус | ✅ |
| Poster incoming order creation | ✅ |
| Часткове списання балів (max 20% від total) | ✅ (вимкнено для Poster-локацій) |
| Перевірка робочих годин | ✅ |
| Перевірка зміни (UNASSIGNED якщо немає зміни) | ✅ |
| Telegram сповіщення (owner + user) | ✅ (через raw fetch) |
| Нарахування балів на COMPLETED | ✅ (idempotent через `awardCompletedOrderLoyalty`) |
| Order status page з polling (5 сек), QR code | ✅ |
| `POST /api/orders/:id/pay` — WayForPay оплата | ❌ |
| Повтор замовлення (repeat order) | ❌ поле `isRepeat` є, endpoint немає |
| Чайові (tips) | ❌ модель `Tip` є, routes немає |
| No-show захист | 🔶 поле `noShowCount` є, логіка блокування не реалізована |

---

## 8) Лояльність

| Фіча | Статус |
|-------|--------|
| `GET /api/loyalty/status` — бали, рівень, множник, спіни, ваучери, транзакції | ✅ |
| `POST /api/loyalty/spin` — Колесо Фортуни | ✅ |
| `GET /api/loyalty/prizes` — список призів | ✅ |
| `POST /api/loyalty/redeem/:code` — активація ваучера (barista+) | ✅ |
| Рівні Bronze/Silver/Gold/Platinum | ✅ |
| Спін = 1 на кожні 5 завершених замовлень | ✅ |
| Нарахування балів: 1 бал за 5 грн × множник рівня | ✅ |
| Idempotency key на кожну транзакцію | ✅ |
| Canvas-анімація колеса (FortuneWheel) | ✅ |
| Birthday bonus (10 балів при онбордингу) | ✅ |
| `GET /api/loyalty/referral` — реферальне посилання | ❌ клієнт викликає, endpoint не існує |
| Реферальний бонус відправнику | ❌ новий юзер отримує 5 балів, інвайтер — ні |
| Згоряння балів (6 місяців) | ❌ |
| Промо-коди | ❌ модель `Promo` є, routes немає |

---

## 9) AI-функції

| Фіча | Статус | Кеш |
|-------|--------|-----|
| `GET /api/ai/weather-menu` — рекомендація за погодою | ✅ | 1 година (hourKey) |
| `GET /api/ai/card-of-day` — кава дня | ✅ | 6-годинні слоти |
| `GET /api/ai/coffee-fact` — цікавий факт | ✅ | 12 годин (todayKey) |
| `POST /api/ai/mood-menu` — рекомендація за настроєм | ✅ | без кешу |
| `GET /api/ai/personal-recommend` — персональна рекомендація | ✅ | daily per user |
| `GET /api/ai/daily-challenge` — денний виклик | ✅ | daily |
| `POST /api/ai/daily-challenge/claim` — забрати нагороду | ✅ | — |

Backend: Anthropic Claude 3.5 Haiku + OpenWeatherMap (Бровари).

---

## 10) Ігри

| Фіча | Статус |
|-------|--------|
| Coffee Jump (Doodle Jump-стиль, Canvas) | ✅ |
| `POST /api/game/coffee-jump/score` — збереження з anti-cheat | ✅ |
| `GET /api/game/coffee-jump/leaderboard` — top 20 | ✅ |
| `GET /api/game/coffee-jump/my-stats` — особиста статистика + нагороди | ✅ |
| Денний ліміт: 50 ігор | ✅ |
| Пороги нагород: 500/1000/2500/5000 | ✅ |
| Tic Tac Toe / Perkie Catch / Barista Rush / Memory Coffee | ❌ enum-и є, реалізації немає |

---

## 11) Радіо

| Фіча | Статус |
|-------|--------|
| `GET /api/radio/playlist` — повний плейлист | ✅ |
| `GET /api/radio/now` — синхронізоване радіо за серверним часом | ✅ |
| `POST /api/radio/add-track` — додати трек (admin) | ✅ |
| `POST /api/radio/user-genre` — зберегти жанр юзера | ✅ |
| RadioPlayer компонент (вбудований у FunPage) | ✅ |
| Фільтрація за жанром у відтворенні | ❌ дані є, `/now` не фільтрує |

---

## 12) Зміни та операції

| Фіча | Статус |
|-------|--------|
| `POST /api/shifts/start` — почати зміну | ✅ |
| `POST /api/shifts/end` — закінчити зміну | ✅ |
| `GET /api/shifts/active` — поточна зміна | ✅ |
| Перевірка ролі (requireBarista/Admin/Owner) | ✅ |
| Історія змін / статистика | ❌ |
| PIN-авторизація бариста | ❌ |
| Автозакриття зміни | ❌ |

---

## 13) Відгуки

| Фіча | Статус |
|-------|--------|
| `POST /api/reviews` — створити відгук (1-5, текст) | ✅ |
| `GET /api/reviews/my` — мої відгуки | ✅ |
| Google Places redirect (rating ≥ 4) | ✅ |
| isPublic = true якщо rating ≥ 4 | ✅ |
| Admin: перегляд відгуків | ❌ |

---

## 14) Сповіщення

| Фіча | Статус |
|-------|--------|
| `GET /api/notifications/settings` — налаштування | ✅ |
| `PATCH /api/notifications/settings` — оновити (spin, winback, morning, promo) | ✅ |
| Telegram сповіщення при зміні статусу замовлення | ✅ (raw fetch) |
| Bot helper функції (8 шт) | ✅ функції написані |
| Інтеграція воркерів з bot helpers | ❌ воркери не відправляють |
| Winback / birthday / morning нагадування | ❌ |

---

## 15) Медіа

| Фіча | Статус |
|-------|--------|
| `GET /api/media/:fileId` — проксі Telegram файлів | ✅ |
| Redis кеш шляхів файлів (23 год TTL) | ✅ |

---

## 16) Poster інтеграція

| Фіча | Статус |
|-------|--------|
| Sync меню кожні 30 хв (BullMQ) | ✅ |
| Initial sync при старті (8 сек delay) | ✅ |
| Webhook закриття замовлення (HMAC-MD5) | ✅ |
| Автозавершення + нарахування балів | ✅ |
| Incoming order creation | ✅ |
| Видалення застарілих продуктів | ✅ |

---

## 17) Admin Panel

### Вбудована (Mini App, `/admin`)
| Фіча | Статус |
|-------|--------|
| Dashboard: stats (users, orders, revenue) | ✅ |
| Users: список, пошук, зміна ролі | ✅ |
| Orders: усі замовлення | ✅ |
| Menu: CRUD продуктів, категорії | ✅ |
| Locations: редагування | ✅ |
| Poster sync trigger | ✅ |
| Runtime DB migrations | ✅ |

### CPanel (окремий десктоп-додаток)
| Фіча | Статус |
|-------|--------|
| Telegram Login Widget (admin-only) | ✅ |
| Desktop sidebar, 5 табів | ✅ |

---

## 18) Telegram Bot

| Фіча | Статус |
|-------|--------|
| `/start` з реферальною підтримкою | ✅ |
| `/menu`, `/profile`, `/help` | ✅ |
| Mini App menu button | ✅ |
| grammY long polling | ✅ |

---

## 19) Health та діагностика

| Endpoint | Опис | Статус |
|----------|------|--------|
| `GET /health` | DB + Redis | ✅ |
| `GET /health/diag` | Кількість записів, env | ✅ |
| `GET /health/test-flow` | Smoke test | ✅ |

---

## 20) Database Schema

| Модель | Статус |
|--------|--------|
| User | ✅ повна (рівні, referrals, notif preferences) |
| Location | ✅ (Poster, printer, working hours) |
| WorkingHours | ✅ |
| Product | ✅ (Poster sync, categories, modifiers) |
| Bundle / BundleItem | ✅ |
| Order / OrderItem | ✅ (повний lifecycle) |
| Shift | ✅ |
| PointsTransaction | ✅ (idempotency) |
| Review | ✅ |
| RadioTrack | ✅ |
| SpinResult / PrizeVoucher | ✅ |
| Promo | ❌ модель є, routes немає |
| Tip | ❌ модель є, routes немає |
| GameSession | ❌ не використовується |

---

## 21) Стартова міграція

Сервер при старті виконує SQL з `IF NOT EXISTS` для всіх можливо відсутніх колонок у таблицях Location, User, Product, Order, OrderItem, Shift, Bundle, Review.

---

## 22) Backlog

### Високий пріоритет
1. `PATCH /api/auth/settings` — клієнт вже викликає
2. `GET /api/loyalty/referral` — клієнт вже викликає
3. Реферальний бонус інвайтеру
4. Інтеграція workers → bot notifications

### Середній пріоритет
5. WayForPay онлайн-оплата
6. Repeat order
7. No-show блокування
8. Промо-коди
9. Чайові (tips)
10. Радіо: жанрова фільтрація
11. Нагадування (winback/birthday/morning)

### Низький пріоритет
12. ESC/POS друк стікерів
13. Додаткові ігри
14. Згоряння балів (6 місяців)
15. Admin: відгуки / аналітика
16. Socket.io realtime
17. Офлайн-захист планшета

---

> Оновлено: Квітень 2026. Відображає фактичний стан реалізації проекту.
