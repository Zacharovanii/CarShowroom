# План проектирования

Проект известен целиком, поэтому до кода проектируем всё ниже. Разделы с пометкой
**черновик** — первая версия, обсуждается и дорабатывается.

## 0. Порядок

1. Сценарии и роли → 2. Контент → 3. ERD → 4. API → 5. Карта маршрутов и вайрфреймы →
6. Дизайн-система → 7. Макеты ключевых экранов → 8. Архитектура фронта →
9. Архитектура бэка → 10. Spikes S1–S3 (см. decisions.md) → 11. Инструменты и тесты →
12. План реализации по этапам и сценарий защиты.

Пункты 3–4 и 6–7 можно вести параллельно.

---

## 1. Сценарии

> **Заменено** документом [use-cases.md](use-cases.md) — там роли, объём сервиса,
> страницы и правила тест-драйва. Версия 2 (19.09.2026) — объём урезан.

## 2. Контент

- 8–12 автомобилей: разные серии, кузова и ценовые диапазоны.
- 2–3 из них — с 3D-моделью, у каждой известно имя материала краски внутри GLB.
- Фото: 3–5 на автомобиль. HDRI для сцены.
- Палитра: 4–6 цветов, общий справочник на весь каталог.
- `docs/assets-licenses.md` — источник, автор, лицензия каждого файла.

**Открыто:** какие конкретно автомобили — зависит от того, для каких найдутся модели (S3).

---

## 3. Схема БД

> **Перенесено** в [db/README.md](db/README.md): 12 таблиц, ERD, решения по нормализации,
> граница «что держит БД, а что API». SQL — в файлах рядом, диаграмма — `db/schema.dbml`.

---

## 4. API

Префикс `/api`. Ошибки — единый формат из contracts:
`{ "error": { "code": "SLOT_TAKEN", "message": "...", "details"?: {...} } }`.
Даты и деньги — строки (инвариант контракта).

| Метод | Путь | Доступ | Назначение |
|---|---|---|---|
| * | `/api/auth/*` | — | Better Auth: sign-up/email, sign-in/email, sign-out, get-session, update-user, change-password |
| GET | `/api/catalog/filters` | гость | справочники для фильтров: серии, кузова, типы двигателя (`id`, `name`, `position`) |
| GET | `/api/cars` | гость | каталог: `q`, `series`, `body`, `fuel` (id из справочников), `drive`, `priceMin`, `priceMax`, `sort`, `page` |
| GET | `/api/cars/:slug` | гость | автомобиль: характеристики, цена, фото, палитра, путь к GLB |
| GET | `/api/cars/:slug/slots` | гость | `date` → 9 слотов дня со статусом свободен/занят/недоступен |
| GET | `/api/me/test-drives` | клиент | свои записи: предстоящие и история |
| POST | `/api/me/test-drives` | клиент | `carId`, `startsAt`, `phone`, `comment?` → 409 `SLOT_TAKEN`, 422 `TOO_MANY_ACTIVE` |
| POST | `/api/me/test-drives/:id/cancel` | клиент | отмена своей будущей записи |
| GET | `/api/manager/test-drives` | менеджер | `date`, `carId?`, `status?` → записи дня с клиентом |
| PATCH | `/api/manager/test-drives/:id` | менеджер | `status`: `completed` / `no_show` / `cancelled` + `cancelReason` |
| GET | `/api/admin/users` | админ | `q?`, `role?`, `page` — список пользователей |
| POST | `/api/admin/users` | админ | `name`, `email`, `phone`, `password` → менеджер |

Коды ошибок: `SLOT_TAKEN` (409), `TOO_MANY_ACTIVE`, `SLOT_OUT_OF_RANGE`,
`SLOT_NOT_ON_GRID`, `ALREADY_CLOSED`, `TOO_LATE_TO_CANCEL`, `SLOT_NOT_STARTED`, `EMAIL_TAKEN`,
`NOT_FOUND`, `FORBIDDEN`, `VALIDATION_FAILED`.

`SLOT_NOT_STARTED` (422) добавлен при реализации менеджера: результат визита
(`completed` / `no_show`) отмечается только после начала слота, а отмена — только до
(UC-M2). Для второй половины правила код уже был — `TOO_LATE_TO_CANCEL`.

**Открыто:** пагинация страницами или «показать ещё» (курсор)? Черновик: `page` + `pageSize`, данных мало.

---

## 5. Карта маршрутов

> **Заменено** разделом «Страницы» в [use-cases.md](use-cases.md).

Вайрфреймы: для каждой страницы — desktop и mobile, со всеми состояниями
(загрузка, пусто, ошибка, гость / клиент / сотрудник).

---

## 6. Дизайн-система

Решение — D10. Что спроектировать:
- **Характер:** настроение (тёмный премиальный шоурум или светлый «журнальный»), референсы.
- **Цвет:** нейтральная шкала, акцент, статусные цвета; проверка контраста WCAG AA.
- **Типографика:** 1–2 шрифта (с кириллицей), шкала размеров, межстрочные, начертания.
- **Пространство:** шкала отступов (4px-база), радиусы, тени, ширина контейнера, сетка.
- **Движение:** 3 длительности, 2–3 easing, правило `prefers-reduced-motion`.
- **Брейкпоинты:** 3 значения.
- **Инвентарь компонентов:** Button, IconButton, Input, Field (label + ошибка), Select,
  Checkbox, RangeSlider (цена), Card, Badge, Tabs, Dialog, Toast, Skeleton, Spinner,
  EmptyState, Header, Footer, CarCard, FilterPanel, ColorSwatch, SlotPicker, PriceTag,
  StatusBadge (статус записи), DataTable (пользователи, записи).
- **Состояния** каждого компонента: hover, focus-visible, active, disabled, loading, error.

## 7. Макеты

Главная, каталог (desktop + mobile), страница автомобиля с 3D и выбором цвета, модалка
тест-драйва, кабинет, список записей менеджера, вход. Можно собрать на дизайн-канвасе и отталкиваться от него при вёрстке.

---

## 8. Архитектура фронта (черновик)

```
apps/web/src/
  main.tsx
  app/                 # App, роутер, провайдеры (QueryClient, AuthProvider, Theme)
  pages/               # страницы-маршруты: тонкие, собирают фичи
  features/
    auth/              # authClient (Better Auth), AuthContext, ProtectedRoute, формы
    catalog/           # useCars, FilterPanel, CarGrid
    car/               # useCar, галерея, характеристики, выбор цвета
    car-viewer/        # 3D: Canvas, CarModel, свет/окружение (грузится лениво)
    test-drives/       # SlotPicker, форма записи, «Мои записи»
    manager/           # список записей дня, смена статуса
    admin/             # список пользователей, форма создания менеджера
  components/
    ui/                # примитивы дизайн-системы
    layout/            # Header, Footer, PageContainer
  shared/
    api/               # fetch-клиент: база, ошибки из contracts, credentials
    format/            # деньги, даты
    hooks/
  styles/              # reset.css, tokens.css, globals.css
```

Правила:
- **Серверное состояние** — только TanStack Query; ключи запросов — фабрикой в фиче.
- **Глобальное клиентское** — Context: сессия и тема. Zustand/Redux не нужны.
- **Фильтры каталога** — в URL (`useSearchParams`): ссылкой можно поделиться, «назад» работает.
- **Формы** — контролируемые инпуты + zod-схема из contracts (без form-библиотеки;
  если форм станет много — react-hook-form).
- Страница не ходит в API напрямую — только через хуки фичи.
- Фича не импортирует другую фичу, кроме `auth` (нужен текущий пользователь).

## 9. Архитектура бэка (черновик)

```
apps/api/
  db/
    migrations/        # dbmate, чистый SQL
    schema.sql         # дамп от dbmate
    seed/              # SQL каталога + скрипт тестовых пользователей
  http/                # .http-сценарии
  src/
    main.ts            # bodyParser: false, глобальный фильтр ошибок
    app.module.ts
    config/            # env через zod, падаем при старте, если конфиг неверный
    db/                # DatabaseModule: провайдер SQL (postgres.js), закрытие пула
    auth/              # betterAuth(): pg Pool, modelName/fields, AuthModule.forRoot
    common/            # ZodValidationPipe, AppError + коды, exception filter
    catalog/           # справочники + cars: controller, service, repository
    test-drives/       # константы правил (rules.ts), сетка слотов, запись, отмена
    manager/           # записи дня, смена статуса
    admin/             # пользователи, создание менеджера
  test/                # e2e: Vitest + supertest, тестовая БД
```

Правила:
- **Repository** — только SQL, принимает `sql | tx`, возвращает строки.
- **Service** — правила и транзакции (`sql.begin`), бросает `AppError` с кодом из contracts.
- **Controller** — валидация через `ZodValidationPipe`, маппинг строк в контракт, `@Session()`.
- Нарушение уникального индекса слота (`23505`) переводится в `SLOT_TAKEN`, а не
  проверяется заранее `select`-ом — БД сама гарантирует отсутствие гонки.
- Все маршруты закрыты глобальным guard Better Auth; публичные — `@AllowAnonymous()`,
  каталог с `isFavorite` — `@OptionalAuth()`.

**Открыто:** маппинг snake_case → camelCase — в SQL (`as "createdAt"`) или
`postgres({ transform: postgres.camel })`? Черновик: `transform`, меньше шума в запросах.

---

## 10. Инструменты и качество

- Корневые скрипты: `dev` (contracts watch + api + web), `db:up`, `db:migrate`, `db:seed`,
  `typecheck`, `lint`, `test`, `build`.
- `docker/compose.yml`: postgres (dev) + postgres (test), volume, healthcheck.
- `.env.example` для api и web.
- Опционально: GitHub Actions с теми же командами.

## 11. Тесты

- **API e2e:** регистрация/вход; каталог с комбинацией фильтров; двойная запись на слот → 409;
  отмена чужой записи → 404; смена статуса клиентом → 403; создание менеджера не-админом → 403.
- **Юнит:** правила тест-драйва (сетка слотов, горизонт, лимит, переходы статусов),
  форматирование денег и дат.
- **Фронт:** минимально — ProtectedRoute, форма регистрации (валидация).

## 12. Реализация и защита

- Этапы после проектирования: spikes → фундамент (монорепо, БД, auth, дизайн-токены,
  layout) → каталог → страница автомобиля → 3D и выбор цвета → тест-драйвы (клиент) →
  экран менеджера → экран админа →
  полировка (анимации, адаптив, пустые состояния, консоль) → прогон сценария защиты.
- Сценарий защиты и распределение ролей (фронт / бэк) — описать отдельно ближе к сдаче.
