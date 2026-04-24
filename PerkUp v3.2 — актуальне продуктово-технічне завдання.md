☕ PerkUp v3.2 — актуальне продуктово-технічне завдання
Версія
Версія: 3.2.0
Дата: Квітень 2026
Проєкт: PerkUp
Тип: Telegram Mini App + Web App + Admin/CPanel + Poster integration
1. Мета проєкту
PerkUp — це гейміфікована екосистема для кав’ярень, яка об’єднує:
- меню;
- передзамовлення;
- програму лояльності;
- інтеграцію з Poster;
- офлайн та онлайн-нарахування балів;
- ігри;
- радіо;
- AI-рекомендації;
- клубну community-зону;
- адмінку для керування продуктом.
Головна бізнес-мета:
збільшити повторні візити, середній чек, залученість клієнтів і впізнаваність бренду PerkUp.
Головна продуктова логіка:
Кава → Бонуси → Гра / Радіо / Клуб → Повторний візит → Замовлення → Бонуси
PerkUp має бути не просто “меню кав’ярні”, а локальною цифровою екосистемою навколо кави, людей і подій.
2. Актуальна архітектура
2.1. Технічний стек
Поточна база проєкту:
Backend:
- Node.js
- Fastify v4
- TypeScript
- PostgreSQL
- Prisma ORM

Frontend Mini App:
- React 18
- Vite
- Tailwind CSS
- Zustand
- HashRouter

Admin / CPanel:
- React 18
- Vite
- Tailwind CSS
- окремий desktop-style застосунок

Telegram Bot:
- grammY
- long polling

Черги / воркери:
- BullMQ
- Redis

Кеш / rate-limit:
- Redis
- redisCache для HTTP/cache
- Redis для BullMQ

Poster:
- Poster API v3
- окремі Poster-акаунти для Крони та Приозерного

AI:
- Anthropic Claude 3.5 Haiku
- OpenWeatherMap API

Медіа:
- Telegram File Storage
- proxy через /api/media/:fileId

Деплой:
- Railway для backend/server і bot
- CPanel для frontend dist
У попередньому ТЗ вже було зафіксовано, що backend працює на Node.js + Fastify + TypeScript, база — PostgreSQL + Prisma, frontend — React/Vite/Tailwind/Zustand, Admin Panel — окремий Vite-проєкт, Telegram Bot — grammY, черги — BullMQ + Redis, а Poster API v3 використовується для окремих акаунтів Крони та Приозерного.
3. Ключові принципи системи
3.1. Баланс балів завжди консистентний
Усі операції з балами проводяться тільки через PointsTransaction.
Кожна транзакція має:
- userId;
- amount;
- type;
- description;
- idempotencyKey;
- createdAt;
Обов’язкове правило:
Одна бізнес-подія = один idempotencyKey = одна транзакція.
Приклади:
earn:order:{orderId}
earn:offline-poster:{posterAccountId}:{posterTransactionId}
earn:pending:{pendingLoyaltyEventId}
game-reward:coffee-jump:{userId}:{date}:{threshold}
community-event-attendance:{eventId}:{userId}
3.2. Poster не є джерелом істини по лояльності
Poster використовується для:
- меню;
- цін;
- наявності товарів;
- касових чеків;
- факту оплати;
- закриття чека.
PerkUp є джерелом істини для:
- користувачів;
- балів;
- рівнів;
- гейміфікації;
- історії лояльності;
- pending-бонусів;
- ігор;
- community-подій.
3.3. Один користувач — один баланс
Клієнт має один баланс PerkUp, незалежно від того, де він купує:
Крона
Приозерний
майбутні локації
Не можна робити окремий баланс для кожного Poster-акаунта.
3.4. Локація обов’язкова всюди
Усі сутності, де це має сенс, повинні мати locationId:
Order
Product
Shift
PendingLoyaltyEvent
CommunityEvent
BoardGameMeetup
PointsTransaction, якщо технічно можливо
Це правило вже було в попередньому ТЗ: меню між локаціями не має змішуватись, а locationId є обов’язковим скрізь.
3.5. WayForPay поки на паузі
Усі сценарії оплати наразі:
CASHIER_ONLY
Тобто:
- клієнт оформлює передзамовлення;
- чек прилітає в Poster;
- клієнт платить на касі;
- Poster закриває чек;
- PerkUp отримує webhook;
- бали нараховуються після підтвердження оплати.
WayForPay не реалізовувати до стабілізації:
- Poster order flow;
- offline loyalty;
- pending loyalty;
- menu sync;
- admin operations.
У попередньому ТЗ WayForPay також був позначений як не підключений, а оплата — лише CASHIER_ONLY.
4. Актуальні формати локацій
4.1. Виправлена модель локацій
Попереднє ТЗ містило плутанину у форматах. Актуальна логіка така:
Mark Mall:
- інформаційна локація;
- меню;
- як добратись;
- без Poster;
- без кошика;
- без передзамовлення;
- без списання балів.

Крона:
- сімейне кафе;
- Poster sync;
- Poster POS;
- передзамовлення через PerkUp;
- оплата на касі;
- онлайн та офлайн-нарахування балів.

Приозерний:
- to-go;
- Poster sync;
- Poster POS;
- передзамовлення через PerkUp;
- оплата на касі;
- онлайн та офлайн-нарахування балів.
4.2. Mark Mall
Призначення
Mark Mall — це не повноцінна ordering-точка. Це інформаційна сторінка.
Доступні функції
- перегляд меню;
- фото товарів;
- опис товарів;
- бейджі “нове”, “топ”, “сезонне”, “рекомендовано”;
- адреса;
- кнопка “Як добратись”;
- інструкція, якщо потрібна.
Заборонено для Mark Mall
- кошик;
- checkout;
- POST /api/orders;
- Poster order creation;
- списання балів;
- статус замовлення;
- WayForPay;
- складна касова логіка.
UI
📍 Mark Mall
Самообслуговування

Тут можна переглянути меню та знайти нашу точку.

[Як добратись]

Меню
[Категорії]

Капучино
Ніжний еспресо з молочною пінкою
75 грн
4.3. Крона
format = FAMILY_CAFE
menuSource = POSTER_SYNC
posSystem = POSTER
paymentFlow = CASHIER_ONLY
remoteOrderingEnabled = true
offlineLoyaltyEnabled = true
Сценарії:
- передзамовлення через PerkUp;
- оплата на касі;
- нарахування балів після закриття Poster-чека;
- офлайн-нарахування балів за номером телефону;
- події community;
- настільні ігри;
- кіновечори.
4.4. Приозерний
format = TO_GO
menuSource = POSTER_SYNC
posSystem = POSTER
paymentFlow = CASHIER_ONLY
remoteOrderingEnabled = true
offlineLoyaltyEnabled = true
Сценарії:
- швидке передзамовлення;
- оплата на касі;
- нарахування балів після закриття Poster-чека;
- офлайн-нарахування балів за номером телефону;
- to-go UX;
- community-події за потреби.
5. Меню
5.1. Джерела меню
Mark Mall:
- LOCAL menu.

Крона:
- POSTER_SYNC.

Приозерний:
- POSTER_SYNC.
У попередньому ТЗ вже існує GET /api/menu/:slug, категорії, QR, printable меню, кеш Redis, sticky категорії, пошук, модифікатори, CRUD для локальних продуктів і Poster sync кожні 30 хв.
5.2. Product model
Актуальний продукт повинен підтримувати:
Product {
  id
  locationId
  posterProductId?
  name
  description?
  price
  category
  categoryOrder
  sortOrder

  imageUrl?
  posterImageUrl?
  telegramFileId?

  isAvailable
  isHiddenInApp

  isNew
  isTop
  isSeasonal
  isRecommended

  modifiers?
  allergens[]
  tags[]
  calories?
  volume?

  createdAt
  updatedAt
}
5.3. Фото товарів
Принцип
Poster може давати фото товару, але PerkUp має дозволяти ручний override.
Пріоритет:
displayImageUrl = product.imageUrl || product.posterImageUrl || defaultPlaceholder
Як використовуємо
posterImageUrl:
- приходить із Poster sync;
- оновлюється автоматично;
- використовується як fallback.

imageUrl:
- задається вручну в адмінці;
- має вищий пріоритет;
- не перетирається Poster sync.
5.4. Опис товарів
Опис краще зберігати в PerkUp, а не повністю покладатися на Poster.
Причина:
Poster = каса та облік.
PerkUp = продаж, емоція, маркетинг, UX.
Приклад:
Poster:
Капучино 250

PerkUp:
Капучино
Ніжний еспресо з молочною пінкою. Класика, яка працює краще за будильник.
Правило Poster sync
Poster sync не повинен перетирати:
description
imageUrl
isNew
isTop
isSeasonal
isRecommended
sortOrder
isHiddenInApp
Poster sync може оновлювати:
name
price
posterImageUrl
posterProductId
category
availability
5.5. Бейджі
Поля:
isNew
isTop
isSeasonal
isRecommended
На фронті показувати максимум один головний бейдж.
Пріоритет:
if (product.isNew) return 'Нове'
if (product.isTop) return 'Топ'
if (product.isSeasonal) return 'Сезонне'
if (product.isRecommended) return 'Радимо'
return null
5.6. Menu API
Endpoint:
GET /api/menu/:slug
Response має містити:
{
  products: [
    {
      id,
      name,
      description,
      price,
      category,
      imageUrl,
      posterImageUrl,
      displayImageUrl,
      isNew,
      isTop,
      isSeasonal,
      isRecommended,
      isAvailable,
      isHiddenInApp,
      sortOrder,
      modifiers,
      tags,
      allergens
    }
  ],
  bundles: [],
  categories: [],
  locationProfile: {
    format,
    posSystem,
    menuManagement,
    paymentFlow,
    remoteOrderingEnabled
  }
}
5.7. Menu cache
Після змін із isHiddenInApp cache має бути розділений для адміна і публічного користувача.
Правильно:
const visibilityScope = isAdmin ? 'admin' : 'public'
const cacheKey = `menu:${locationSlug}:${visibilityScope}`
Неправильно:
const cacheKey = `menu:${locationSlug}`
Чому:
Якщо admin прогріє cache, hidden-продукти можуть потрапити звичайному користувачу.
6. Замовлення
6.1. Онлайн-передзамовлення
Працює тільки для:
Крона
Приозерний
Не працює для:
Mark Mall
6.2. Flow передзамовлення
Клієнт відкриває PerkUp
→ обирає Крона або Приозерний
→ додає товари в кошик
→ вводить / підтверджує телефон
→ залишає коментар
→ підтверджує замовлення
→ backend створює Order у PerkUp
→ backend створює incoming order / чек у Poster
→ бариста бачить замовлення на планшеті
→ клієнт платить на касі
→ Poster закриває чек
→ webhook приходить у PerkUp
→ PerkUp завершує Order
→ PerkUp нараховує бали
6.3. Чому Poster-запити тільки через backend
Запити до Poster не можна робити напряму з frontend. У матеріалах по Poster зазначено, що браузерні запити блокуються, тому схема має бути: клієнт → ваш backend → Poster API.
Правильно:
Mini App
→ PerkUp Backend
→ Poster API
Неправильно:
Mini App
→ Poster API напряму
6.4. Order statuses
Рекомендована модель:
CREATED
PENDING_POSTER
POSTER_CREATED
ACCEPTED
PREPARING
READY
COMPLETED
CANCELLED
FAILED_POSTER
6.5. Якщо Poster недоступний
Не губити замовлення.
1. Створити Order у PerkUp.
2. Позначити FAILED_POSTER або PENDING_RETRY.
3. Додати задачу в BullMQ retry queue.
4. Показати адміну Problem Order.
Це відповідає принципу з попереднього ТЗ: замовлення не мають губитися, при недоступності Poster має бути retry queue через BullMQ.
7. Poster integration
7.1. Для чого використовується Poster
- синхронізація меню;
- синхронізація цін;
- створення замовлень;
- отримання факту закриття чека;
- офлайн-нарахування балів за номером телефону;
- майбутнє списання балів через POS-плагін.
7.2. Poster accounts
У системі є окремі Poster-акаунти:
Крона
Приозерний
Кожна Poster-локація має:
Location {
  posterAccountId?
  posterToken?
  posterSpotId?
  posterWaiterId?
  posterSubdomain?
}
7.3. Webhooks
Poster webhook використовується для:
- завершення онлайн-замовлення;
- нарахування балів після закриття чека;
- офлайн-нарахування балів;
- оновлення меню/цін, якщо підключено product webhook.
У матеріалах по Poster зафіксовано: webhook надсилає базові дані, зокрема object_id, а backend має зробити додатковий GET-запит до Poster API, щоб отримати повну інформацію по чеку або товару. Також сервер має швидко відповідати 200, інакше Poster повторює webhook і може зупинити відправку.
8. Лояльність
8.1. Центральна логіка
PerkUp має єдину систему балів.
Один користувач
Один баланс
Декілька локацій
Декілька Poster-акаунтів
Одна loyalty ledger
8.2. Поточна формула
Згідно з поточним ТЗ, нарахування:
1 бал за 5 грн × множник рівня
Рівні:
Bronze
Silver
Gold
Platinum
У попередньому ТЗ це вже було зафіксовано: рівні Bronze/Silver/Gold/Platinum, спін за кожні 5 завершених замовлень, нарахування 1 бал за 5 грн × множник рівня, idempotency key на кожну транзакцію.
8.3. Коли нараховуються бали
Бали нараховуються тільки після підтвердженої покупки:
- онлайн-передзамовлення: після закриття Poster-чека;
- офлайн-покупка: після закриття Poster-чека;
- pending-покупка: після реєстрації користувача з відповідним телефоном;
- ігри: після backend validation;
- community: тільки за підтверджену участь у події.
Не нараховувати бали:
- на етапі створення замовлення;
- за скасовані чеки;
- за нульові чеки;
- за повернення;
- за повідомлення в чаті;
- за спам-активність.
9. Онлайн-лояльність
9.1. Онлайн-нарахування
Flow:
PerkUp Order створено
→ Poster чек створено
→ клієнт оплатив на касі
→ Poster webhook прийшов
→ PerkUp знайшов Order за posterTransactionId
→ перевірив, що Order ще не rewarded
→ створив PointsTransaction
→ збільшив User.points
Idempotency:
earn:order:{orderId}
або:
earn:order:{orderId}:poster:{posterTransactionId}
9.2. Онлайн-списання балів
Поточний стан:
списання для Poster-локацій поки не запускати як основну функцію, доки не готовий безпечний hold/commit flow.
Майбутня схема:
1. Клієнт обирає списати бали.
2. Backend створює REDEEM_HOLD.
3. Замовлення летить у Poster.
4. Після закриття чека REDEEM_HOLD → COMMITTED.
5. Якщо чек скасовано — REDEEM_HOLD → CANCELLED.
10. Офлайн-лояльність через Poster
10.1. Навіщо
Клієнт може прийти в кав’ярню офлайн, без відкриття PerkUp, купити каву на касі, назвати номер телефону, і все одно отримати бали.
10.2. Офлайн-нарахування
Flow:
Клієнт купує на касі
→ бариста вводить телефон у Poster
→ чек закривається
→ Poster webhook приходить у PerkUp
→ PerkUp отримує деталі чека через Poster API
→ витягує телефон
→ нормалізує телефон
→ шукає User.phone
→ якщо User знайдено — нараховує бали
→ якщо User не знайдено — створює PendingLoyaltyEvent
10.3. Нормалізація телефону
Helper:
normalizePhone(phone: string): string | null
normalizePhoneOrThrow(phone: string): string
Підтримка форматів:
0671234567
380671234567
+380671234567
067 123 45 67
+38 (067) 123-45-67
Результат:
+380671234567
10.4. PendingLoyaltyEvent
Якщо користувача з телефоном ще немає, бали не губляться.
model PendingLoyaltyEvent {
  id                  String
  phone               String
  locationId           Int?
  posterAccountId      String?
  posterTransactionId  String
  totalAmount          Int
  points               Int
  status               PendingLoyaltyStatus
  expiresAt            DateTime?
  claimedByUserId      Int?
  claimedAt            DateTime?
  createdAt            DateTime
  updatedAt            DateTime
}
Statuses:
PENDING
CLAIMED
EXPIRED
10.5. Claim pending-бонусів
Коли користувач:
- реєструється;
- проходить onboarding;
- додає телефон;
- оновлює телефон;
backend має:
1. нормалізувати телефон;
2. знайти PendingLoyaltyEvent status=PENDING;
3. створити PointsTransaction;
4. збільшити User.points;
5. позначити event як CLAIMED.
Idempotency:
earn:pending:{pendingLoyaltyEventId}
10.6. Офлайн-списання
На цьому етапі повністю не реалізовувати.
Майбутні варіанти:
1. Бариста-панель PerkUp:
   - пошук клієнта за телефоном;
   - перегляд балансу;
   - ручне підтвердження списання;
   - бариста вручну застосовує знижку в Poster.

2. Poster POS-плагін:
   - кнопка PerkUp у Poster;
   - popup із балансом;
   - автоматичне застосування знижки;
   - hold/commit після закриття чека.
Poster POS-платформа дозволяє додавати власні кнопки в інтерфейс каси, відкривати popup через iframe і взаємодіяти з активними чеками, тому це правильний майбутній шлях для списання бонусів на касі.
11. Admin / CPanel
11.1. Призначення
Admin/CPanel потрібна для:
- керування локаціями;
- керування меню;
- керування продуктами;
- перегляду замовлень;
- запуску Poster sync;
- керування лояльністю;
- перегляду pending loyalty events;
- керування радіо;
- керування іграми;
- керування community.
11.2. Меню в адмінці
Форма продукту повинна мати:
- назва;
- категорія;
- ціна;
- опис;
- фото / imageUrl;
- posterImageUrl readonly;
- isNew;
- isTop;
- isSeasonal;
- isRecommended;
- isHiddenInApp;
- sortOrder;
- isAvailable;
Для Poster-продуктів:
- назва та ціна керуються Poster;
- опис, фото override, бейджі та видимість керуються PerkUp.
11.3. Pending loyalty admin
Endpoint:
GET /api/admin/loyalty/pending
Фільтри:
status
phone
locationId
Admin UI:
Pending бонуси
- телефон;
- локація;
- Poster transaction ID;
- сума;
- бали;
- статус;
- дата;
- claimedByUser, якщо є.
11.4. Manual award
Не видаляти без перевірки.
Потрібні endpoint-и, якщо їх використовує бот або бариста-панель:
POST /api/admin/manual-award
GET /api/admin/find-user-by-phone
Ці endpoint-и мають бути захищені:
- BOT_SECRET для бота;
- або JWT + role BARISTA/ADMIN/OWNER.
12. Ігри
12.1. Поточна база
У поточному ТЗ уже є:
Coffee Jump
POST /api/game/coffee-jump/score
GET /api/game/coffee-jump/leaderboard
GET /api/game/coffee-jump/my-stats
денний ліміт 50 ігор
пороги 500/1000/2500/5000
Це зафіксовано в попередньому ТЗ.
12.2. Призначення ігор
Ігри — retention-механіка.
Зайшов → пограв → отримав маленьку винагороду → повернувся завтра → зробив замовлення
Ігри не повинні бути фармом балів.
12.3. Coffee Jump
Залишити як основну гру.
Backend має перевіряти:
- score >= 0;
- score не нереалістично високий;
- денний ліміт;
- reward thresholds;
- idempotency;
- global daily game reward cap.
Рекомендовані threshold-нагороди:
500 score  → +1 бал once per day
1000 score → +2 бали once per day
2500 score → +3 бали once per day
5000 score → +5 балів once per day
12.4. Memory Coffee
Додати як просту другу гру.
Суть:
4x4 картки
8 пар
відкрити всі пари
рахуються moves і duration
Endpoints:
POST /api/game/memory-coffee/result
GET /api/game/memory-coffee/my-stats
GET /api/game/memory-coffee/leaderboard
Rewards:
завершив гру → +1 бал once/day
до 60 сек → +2 бали once/day
до 40 сек → +3 бали once/day
12.5. GameSession
Якщо модель є — задіяти.
model GameSession {
  id
  userId
  gameType
  score?
  moves?
  durationSec?
  metadata?
  isAccepted
  rejectReason?
  playedAt
}
12.6. Daily caps
Coffee Jump: 50 ігор / день
Memory Coffee: 20 ігор / день
Global game reward cap: 20 балів / день
Важливо:
cap має оновлюватися атомарно, бажано через Redis transaction/Lua або інший atomic механізм.
13. Радіо
13.1. Поточна база
У поточному ТЗ є:
GET /api/radio/playlist
GET /api/radio/now
POST /api/radio/add-track
POST /api/radio/user-genre
RadioPlayer
Але жанрова фільтрація у /now ще не реалізована.
13.2. Мета радіо
Радіо — це бренд-атмосфера.
PerkUp Radio = цифровий настрій кав’ярні.
Функції:
- now playing;
- play/pause;
- mute;
- жанри;
- обкладинка;
- синхронізація по серверному часу;
- fallback, якщо жанр порожній.
13.3. RadioTrack
model RadioTrack {
  id
  title
  artist?
  genre?
  audioUrl
  coverUrl?
  durationSec
  isActive
  sortOrder
  createdAt
  updatedAt
}
13.4. Radio now
Endpoint:
GET /api/radio/now?genre=lofi
Response:
{
  track,
  serverTime,
  startedAt,
  positionSec,
  nextTrack
}
Правила:
- якщо genre є — фільтруємо активні треки по genre;
- якщо жанр порожній — fallback на всі активні;
- усі користувачі з одним genre чують однаковий трек у той самий момент;
- синхронізація за server time.
13.5. Важливий урок після інциденту FunPage
Не робити великий rewrite FunPage одним PR.
Правильно:
PR 1: стабілізація FunPage
PR 2: окремий RadioPlayer
PR 3: підключення RadioPlayer у FunPage
PR 4: Memory Coffee
PR 5: Games Hub
Неправильно:
одним PR переписати FunPage, radio, games, leaderboard і rewards.
14. Fun Zone
14.1. Склад
Fun Zone включає:
- Coffee Jump;
- Memory Coffee;
- PerkUp Radio;
- leaderboard;
- rewards;
- майбутні ігри.
14.2. Стабільність
FunPage.tsx має бути простим контейнером, не монолітом на 500+ рядків.
Рекомендована структура:
client/src/pages/FunPage.tsx
client/src/components/fun/FunTabs.tsx
client/src/components/fun/RadioPlayer.tsx
client/src/components/fun/GamesHub.tsx
client/src/components/fun/CoffeeJumpSection.tsx
client/src/components/fun/MemoryCoffeeSection.tsx
client/src/components/fun/RewardsPanel.tsx
client/src/components/fun/LeaderboardPanel.tsx
FunPage тільки збирає компоненти.
15. Community / Клуб PerkUp
15.1. Мета
Community — це соціальний шар PerkUp.
Кава + люди + привід прийти
Склад:
- міні-чат;
- гілка “Настільні ігри”;
- пошук партнерів для настільних ігор;
- кіновечори;
- події;
- RSVP;
- голосування за фільм;
- модерація.
15.2. Назва в UI
Рекомендована назва:
Клуб PerkUp
15.3. Chat
Канали:
GENERAL
BOARD_GAMES
MOVIE_NIGHTS
Endpoint-и:
GET /api/community/chat/messages
POST /api/community/chat/messages
DELETE /api/community/chat/messages/:id
PATCH /api/admin/community/messages/:id/hide
Правила:
- тільки авторизовані користувачі можуть писати;
- max 500 символів;
- rate limit 10 повідомлень / хв;
- не показувати телефон;
- не показувати telegramId;
- користувач може видалити своє;
- адмін може приховати будь-яке.
15.4. Board Games
Функції:
- каталог настільних ігор;
- створення meetup;
- приєднання;
- вихід;
- статус FULL;
- скасування creator/admin.
Models:
BoardGame
BoardGameMeetup
BoardGameMeetupParticipant
Endpoints:
GET /api/community/board-games
GET /api/community/board-game-meetups
POST /api/community/board-game-meetups
POST /api/community/board-game-meetups/:id/join
POST /api/community/board-game-meetups/:id/leave
POST /api/community/board-game-meetups/:id/cancel
15.5. Movie Nights
Кіновечори створює admin.
Функції:
- event details;
- RSVP “Я піду”;
- leave;
- голосування за фільм;
- обговорення в channel MOVIE_NIGHTS.
Models:
CommunityEvent
CommunityEventParticipant
MovieOption
MovieVote
Endpoints:
GET /api/community/events
GET /api/community/events/:id
POST /api/community/events/:id/join
POST /api/community/events/:id/leave
POST /api/community/events/:id/vote-movie
POST /api/admin/community/events
PATCH /api/admin/community/events/:id
POST /api/admin/community/events/:id/complete
15.6. Community rewards
Не давати бали за чат.
Можна давати:
- +5 / +10 балів за підтверджену участь у кіновечорі;
- +5 балів за участь у настільній грі;
- окремі призи за турніри.
Тільки через admin або confirmed attendance.
Idempotency:
community-event-attendance:{eventId}:{userId}
16. AI
16.1. Поточні функції
У системі вже є:
GET /api/ai/weather-menu
GET /api/ai/card-of-day
GET /api/ai/coffee-fact
POST /api/ai/mood-menu
GET /api/ai/personal-recommend
GET /api/ai/daily-challenge
POST /api/ai/daily-challenge/claim
Це зафіксовано в попередньому ТЗ.
16.2. Як використовуємо AI
AI має працювати як retention/upsell layer:
- рекомендація напою за погодою;
- рекомендація за настроєм;
- персональна рекомендація;
- кава дня;
- daily challenge;
- майбутній AI Control Center.
16.3. Guardrails
AI не має напряму змінювати фінансову логіку.
Потрібні обмеження:
- max discount hard limit;
- whitelist продуктів;
- budget control;
- logs;
- roles:
  owner — повний контроль;
  manager — перегляд;
  barista — не бачить AI Control.
У попередньому AI-документі вже було зазначено, що UI не є безпекою, а guardrails треба робити на backend: max discount hard limit, whitelist продуктів, budget control.
17. Telegram Bot
Поточні функції
/start з referral
/menu
/profile
/help
Mini App menu button
grammY long polling
Що важливо
Referral flow має бути без втрат:
якщо invitee ще не створений у User, referral не має губитися.
Треба зберігати pending referral або обробляти його після першого WebApp auth.
18. Notifications
Поточне:
- налаштування notifications є;
- Telegram сповіщення при зміні статусу замовлення є;
- winback/birthday/morning ще не реалізовані.
Правила
Не спамити.
Особливо:
- не слати Telegram за кожне game reward;
- не слати Telegram за кожне chat message;
- community reminders робити тільки як окремий майбутній модуль.
Можна:
- статус замовлення;
- важлива подія;
- нагадування про кіновечір, якщо user RSVP;
- winback, якщо user дозволив.
19. Security / Privacy
Заборонено
- BOT_TOKEN на frontend;
- Poster token на frontend;
- показувати phone в чаті;
- показувати telegramId;
- нараховувати бали без idempotency;
- довіряти score гри з frontend без backend validation;
- робити Poster API з браузера;
- логувати токени.
20. Деплой
20.1. Railway
Для:
server
bot
workers
20.2. CPanel
Для:
client/dist
CPanel/dist
20.3. Після інциденту з PR №29
Codex у PR №29 змінив deploy path і прибрав SPA fallback. Це потенційно може ламати routing.
Правило:
Не змінювати deploy path без явного підтвердження фактичного URL і структури CPanel.
Для SPA потрібен fallback:
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
Якщо app живе в підпапці, треба налаштовувати:
Vite base
.htaccess RewriteBase
server-dir у deploy.yml
21. UI / UX правила
21.1. Головний екран
Має відповідати на 4 питання:
1. Де я?
2. Що можна зробити?
3. Скільки в мене бонусів?
4. Яка наступна вигідна дія?
21.2. Mark Mall
Не показувати зайві дії.
Меню + як добратись.
21.3. Крона / Приозерний
Показувати:
- меню;
- кошик;
- бонуси;
- передзамовлення;
- оплату на касі;
- статус замовлення.
21.4. Нейромаркетинг
Застосунок має поєднувати раціональне й емоційне: не просто показувати функцію, а створювати позитивне відчуття після взаємодії. У ваших нотатках зафіксовано, що користувачу потрібно давати підтвердження правильності вибору після дії, а продукт має поєднувати раціональну і емоційну цінність.
Приклади:
Після замовлення:
“Замовлення прийнято. Бариста вже бачить його ☕”

Після нарахування:
“+3 бали. До наступної кавової переваги ближче.”

Після гри:
“Гарний забіг! +2 бали на баланс.”
22. Тестування
22.1. Мінімальні build checks
Перед merge:
cd client && npm run build
cd server && npm run build
cd CPanel && npm run build
або фактичні scripts із package.json.
22.2. Smoke test
Перевірити:
- Home відкривається;
- Menu відкривається;
- Mark Mall не показує кошик;
- Крона показує кошик;
- Приозерний показує кошик;
- Fun Zone відкривається;
- Coffee Jump відкривається;
- Radio не валить FunPage;
- /api/menu/:slug працює;
- /api/locations працює;
- /api/loyalty/status працює;
22.3. FunPage stability rule
Після інциденту:
FunPage не переписувати великим PR.
Кожна нова фіча:
- окремий компонент;
- окремий endpoint;
- окремий PR;
- build перевірка.
23. Backlog за пріоритетами
P0 — стабільність
- відновити FunPage після PR №29;
- прибрати duplicate imports;
- виправити menu cache visibility;
- перевірити deploy path;
- повернути manual-award/find-user-by-phone, якщо використовуються.
P1 — меню та локації
- виправити формати локацій;
- Mark Mall = меню + як добратись;
- Крона = family cafe + Poster;
- Приозерний = to-go + Poster;
- фото з Poster;
- ручні описи;
- бейджі;
- hidden products;
- admin product form.
P2 — офлайн-лояльність
- Poster webhook для офлайн-чеків;
- пошук User за телефоном;
- PendingLoyaltyEvent;
- claim pending при onboarding;
- admin pending list.
P3 — Radio + Games
- Radio genre filtering;
- RadioPlayer;
- Memory Coffee;
- Games Hub;
- game reward cap;
- admin game stats.
P4 — Community
- Клуб PerkUp;
- чат;
- настільні ігри;
- meetup;
- кіновечори;
- RSVP;
- movie voting;
- admin moderation.
P5 — майбутнє
- WayForPay;
- Poster POS-плагін для списання балів;
- ESC/POS друк;
- Socket.io realtime;
- winback/birthday/morning reminders;
- промо-коди;
- чайові;
- no-show блокування.
24. Коротке ТЗ для Codex: оновити документацію в репозиторії
Create/update docs/perkup-v3.2-product-tech-spec.md.

The document must reflect the current agreed PerkUp architecture and product decisions:

1. Correct location formats:
- Mark Mall = info/menu only, no Poster, no cart, no ordering, no loyalty redeem.
- Krona = family cafe, Poster sync/POS, cashier-only payment.
- Pryozernyi = to-go, Poster sync/POS, cashier-only payment.

2. Describe menu architecture:
- local menu for Mark Mall;
- Poster sync for Krona/Pryozernyi;
- product fields: description, imageUrl, posterImageUrl, isNew, isTop, isSeasonal, isRecommended, isHiddenInApp, sortOrder;
- Poster sync must not overwrite marketing fields;
- displayImageUrl priority;
- admin/public menu cache separation.

3. Describe order flow:
- online preorder only for Poster locations;
- payment is cashier-only;
- WayForPay is paused;
- Poster API calls only from backend;
- Poster webhook completes orders and triggers rewards.

4. Describe loyalty:
- PerkUp is source of truth for points;
- one user = one balance across locations;
- PointsTransaction with idempotency;
- online earn after completed Poster check;
- offline earn by Poster webhook + phone lookup;
- PendingLoyaltyEvent for unknown users;
- claim pending events on onboarding/phone update;
- offline redeem postponed.

5. Describe radio and games:
- RadioPlayer, /api/radio/now, genre filtering, server-time sync;
- Coffee Jump preserved;
- Memory Coffee planned/added;
- GameSession;
- daily game caps;
- no unlimited point farming.

6. Describe Community:
- Club PerkUp;
- chat channels GENERAL, BOARD_GAMES, MOVIE_NIGHTS;
- board game meetups;
- movie nights;
- RSVP;
- movie voting;
- moderation;
- no points for chat messages.

7. Describe admin/CPanel:
- product marketing fields;
- pending loyalty events;
- radio tracks;
- games stats;
- community moderation.

8. Describe deployment and stability rules:
- Railway for backend/bot;
- CPanel for frontend;
- SPA fallback;
- do not change deploy path without confirmation;
- FunPage must be modular;
- every PR must pass client/server build.

Also add a short “Current P0 Hotfix” section:
- restore broken FunPage after PR #29;
- fix duplicate imports/undefined variables;
- fix menu cache visibility;
- verify CPanel deploy path;
- check manual-award endpoints.
25. Один головний принцип на майбутнє
Спочатку стабільне ядро.
Потім фічі.
Потім вау-ефект.
Бо якщо головна, меню і Fun Zone не відкриваються — це вже не MVP, це escape room для клієнта. А нам потрібна кав’ярня, а не технічний квест.
