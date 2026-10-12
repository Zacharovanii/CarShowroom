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

Префикс `/api` — у всех эндпоинтов, кроме раздачи файлов: `/assets/*` (seed-файлы
из репозитория и `licensed-assets`, D15.1, D25) и `/media/*` (загруженные админом,
из MinIO, D26). Пути к файлам лежат в БД целиком, фронт подставляет их как есть
и `/assets` от `/media` не отличает. Ошибки — единый формат из contracts:
`{ "error": { "code": "SLOT_TAKEN", "message": "...", "details"?: {...} } }`.
Даты и деньги — строки (инвариант контракта).

| Метод | Путь | Доступ | Назначение |
|---|---|---|---|
| * | `/api/auth/*` | — | Better Auth: sign-up/email, sign-in/email, sign-out, get-session, update-user, change-password |
| GET | `/api/catalog/filters` | гость | справочники для фильтров: серии, кузова, типы двигателя (`id`, `name`, `position`) |
| GET | `/api/cars` | гость | каталог: `q`, `series`, `body`, `fuel` (id из справочников), `drive`, `priceMin`, `priceMax`, `sort`, `page` |
| GET | `/api/cars/:slug` | гость | автомобиль: характеристики, цена, фото, палитра, путь к GLB; черновик → 404 `NOT_FOUND` |
| GET | `/api/cars/:slug/slots` | гость | `date` → 9 слотов дня со статусом свободен/занят/недоступен; черновик → 404 `NOT_FOUND` |
| GET | `/api/me/test-drives` | клиент | свои записи: предстоящие и история |
| POST | `/api/me/test-drives` | клиент | `carId`, `startsAt`, `phone`, `comment?` → 409 `SLOT_TAKEN`, 422 `TOO_MANY_ACTIVE`, черновик → 404 `NOT_FOUND` |
| POST | `/api/me/test-drives/:id/cancel` | клиент | отмена своей будущей записи |
| GET | `/api/manager/test-drives` | менеджер | `date`, `carId?`, `status?` → записи дня с клиентом |
| PATCH | `/api/manager/test-drives/:id` | менеджер | `status`: `completed` / `no_show` / `cancelled` + `cancelReason` |
| GET | `/api/admin/users` | админ | `q?`, `role?`, `page` — список пользователей |
| POST | `/api/admin/users` | админ | `name`, `email`, `phone`, `password` → менеджер |
| GET | `/api/admin/cars` | админ | `q?` (название, slug), `status?` (`all` по умолчанию / `published` / `draft`), `page` — список вместе с черновиками |
| GET | `/api/admin/cars/options` | админ | справочники для формы: серии, кузова, типы двигателя, цвета (`id`, `name`) |
| GET | `/api/admin/cars/:id` | админ | карточка для редактирования: id справочников, `colorIds`, фото (`id`, `position`, `path`, `alt`), модель, `isPublished`, `testDrivesCount` → 404 `NOT_FOUND` |
| POST | `/api/admin/cars` | админ | поля автомобиля, `slug`, `colorIds` → 201, черновик (`isPublished: false`); 409 `SLUG_TAKEN`, `NAME_TAKEN` |
| PATCH | `/api/admin/cars/:id` | админ | любые поля, `slug`; `colorIds` заменяет палитру целиком → 409 `SLUG_TAKEN`, `NAME_TAKEN` |
| POST | `/api/admin/cars/:id/publish` | админ | опубликовать; повтор — 200 без изменений → 409 `CAR_NOT_READY` (нет ни одного фото) |
| POST | `/api/admin/cars/:id/unpublish` | админ | снять с публикации; повтор — 200 без изменений, ограничений нет |
| DELETE | `/api/admin/cars/:id` | админ | удалить вместе с файлами в MinIO → 204; 409 `CAR_HAS_TEST_DRIVES` (есть записи в любом статусе) |
| POST | `/api/admin/cars/:id/images` | админ | multipart `file`, `alt` → 201, фото в конец |
| PUT | `/api/admin/cars/:id/images/:imageId/file` | админ | multipart `file` — заменить файл; `position` и `alt` не меняются |
| PATCH | `/api/admin/cars/:id/images/:imageId` | админ | `alt` |
| PUT | `/api/admin/cars/:id/images/order` | админ | `imageIds` — полный новый порядок, ровно текущие фото → 400 `VALIDATION_FAILED` |
| DELETE | `/api/admin/cars/:id/images/:imageId` | админ | удалить, позиции сдвигаются без дыр → 409 `LAST_IMAGE` (последнее фото опубликованного) |
| PUT | `/api/admin/cars/:id/model` | админ | multipart `file` (GLB), `paintMaterial` (`CarPaint` по умолчанию) → 400 `PAINT_MATERIAL_NOT_FOUND` |
| DELETE | `/api/admin/cars/:id/model` | админ | убрать модель: `model_3d_path` и `paint_material` → `null` |
| GET | `/media/*` | все | вне `/api`: загруженный файл из MinIO, `Cache-Control: public, max-age=31536000, immutable` (ключ с uuid, файл по ключу не меняется); публикацию не проверяет → 404, если объекта нет |

**Загрузка файлов** — `multipart/form-data` через Nest, поле `file` (+ `alt` у фото,
+ `paintMaterial` у модели). Лимиты: фото 10 МБ (JPEG, PNG, WebP, AVIF), модель 60 МБ
(GLB 2.0). Формат проверяется по сигнатуре файла, а не по `mimetype` от клиента; у GLB
API дополнительно разбирает JSON-чанк и ищет материал `paintMaterial`. Все мутации
карточки, фото и модели возвращают полную админскую карточку (как
`GET /api/admin/cars/:id`) — фронт кладёт её в кеш без второго запроса. Исключение —
`DELETE /api/admin/cars/:id`: карточки больше нет, ответ 204. Не найден автомобиль или
фото (в том числе фото чужого автомобиля) — 404 `NOT_FOUND`.

Коды ошибок: `SLOT_TAKEN` (409), `TOO_MANY_ACTIVE`, `SLOT_OUT_OF_RANGE`,
`SLOT_NOT_ON_GRID`, `ALREADY_CLOSED`, `TOO_LATE_TO_CANCEL`, `SLOT_NOT_STARTED`, `EMAIL_TAKEN`,
`NOT_FOUND`, `FORBIDDEN`, `VALIDATION_FAILED`; управление каталогом (D26): `SLUG_TAKEN`,
`NAME_TAKEN`, `CAR_HAS_TEST_DRIVES`, `CAR_NOT_READY`, `LAST_IMAGE` (409), `INVALID_FILE`,
`PAINT_MATERIAL_NOT_FOUND` (400, в `details.materials` — имена материалов в файле),
`FILE_TOO_LARGE` (413).

`SLOT_NOT_STARTED` (422) добавлен при реализации менеджера: результат визита
(`completed` / `no_show`) отмечается только после начала слота, а отмена — только до
(UC-M2). Для второй половины правила код уже был — `TOO_LATE_TO_CANCEL`.

Коды каталога добавлены с управлением каталогом из админки (D26). `SLUG_TAKEN` и
`NAME_TAKEN` — перевод `unique_violation` (23505) по имени ограничения (`cars_slug_uq`,
`cars_name_uq`), как `SLOT_TAKEN`: БД сама гарантирует уникальность, отдельный `select`
не нужен. `CAR_HAS_TEST_DRIVES` — удалять автомобиль с историей записей нельзя, его
снимают с публикации. `CAR_NOT_READY` и `LAST_IMAGE` — две стороны одного правила
«у опубликованного автомобиля есть хотя бы одно фото»: без обложки карточка каталога
пустая. Ошибки файла отделены от `VALIDATION_FAILED`, чтобы форма показала их у поля
загрузки, а не у полей карточки; для `PAINT_MATERIAL_NOT_FOUND` список материалов
в `details` позволяет админу сразу исправить имя.

**Открыто:** пагинация страницами или «показать ещё» (курсор)? Черновик: `page` + `pageSize`, данных мало.

---

## 5. Карта маршрутов

> **Заменено** разделом «Страницы» в [use-cases.md](use-cases.md).

**Дополнено D26** (13.10.2026) — страницы управления каталогом. Источник истины —
по-прежнему «Страницы» в use-cases.md, здесь только сводка:

- `/admin/cars` — список автомобилей с черновиками: поиск по названию и slug, фильтр
  «все / опубликованные / черновики», страницы, кнопка «Добавить автомобиль».
- `/admin/cars/new` — создание черновика: только поля карточки и палитра. После
  сохранения — переход на `/admin/cars/:id`: фото и модель привязываются к `id`,
  которого до создания нет.
- `/admin/cars/:id` — редактирование: поля и палитра, фото (загрузка, замена, `alt`,
  порядок, удаление), 3D-модель, «Опубликовать» / «Снять с публикации», удаление
  (при записях вместо него предлагается снять с публикации).

Доступ — админ. В админской навигации два пункта: «Пользователи» (`/admin/users`)
и «Автомобили» (`/admin/cars`); вход админа по-прежнему ведёт на `/admin/users`.

Вайрфреймы: для каждой страницы — desktop и mobile, со всеми состояниями
(загрузка, пусто, ошибка, гость / клиент / сотрудник).

---

## 6. Дизайн-система

> **Перенесено** в [design-system.md](design-system.md): характер, цвет с проверкой
> контраста, типографика, пространство, движение, брейкпоинты и инвентарь компонентов
> с состояниями. Значения — в `apps/web/src/styles/tokens.css`, живая витрина —
> [styleguide.html](styleguide.html). Уточнения к D10 записаны в D21 и D23.

Исходный список того, что требовалось спроектировать:
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

> **Перенесено** в [wireframes.md](wireframes.md): каркасы всех страниц в двух раскладках
> со состояниями (загрузка, пусто, ошибка, гость против вошедшего) и сводной таблицей
> состояний в конце.

---

## 8. Архитектура фронта

Сверено с кодом на этапе 11, дополнено D26 (фронт админки каталога) — дерево ниже
описывает то, что есть.

```
apps/web/src/
  main.tsx
  app/                 # App (провайдеры: QueryClient, AuthProvider, ToastProvider,
                       #   BrowserRouter), AppRoutes — карта маршрутов
  pages/               # страницы-маршруты: тонкие, собирают фичи;
                       #   admin/ — UsersPage, CarsPage, CarNewPage, CarEditPage
  features/
    auth/              # authClient (Better Auth), AuthContext, ProtectedRoute/RoleRoute/
                       #   GuestOnlyRoute, формы входа, регистрации, профиля, пароля
    catalog/           # useCars, useCatalogFilters, useCatalogQuery, CarCard,
                       #   CatalogSearch, FilterPanel, PriceRange
    car/               # useCar, CarMedia, Gallery, CarSpecs, CarPageSkeleton
    car-viewer/        # 3D: Canvas, CarModel, свет, ColorPicker (грузится лениво)
    test-drives/       # DayStrip, SlotGrid, BookingDialog, «Мои записи», отмена
    manager/           # день записей, фильтры, таблица, панель смены статуса
    admin/             # список пользователей, форма создания менеджера
    admin-cars/        # управление каталогом (D26): хуки списка, справочников, карточки
                       #   и мутаций (полей, публикации, фото, модели), AdminCarsList,
                       #   AdminCarForm, AdminCarActions, AdminCarImages, AdminCarModel
  components/
    ui/                # примитивы дизайн-системы (инвентарь — design-system.md §8)
    layout/            # RootLayout (каркас с <Outlet />), Header, Footer
  shared/
    api/               # fetch-клиент: база, ошибки из contracts, credentials;
                       #   FormData в body уходит multipart-ом без JSON-заголовка
    format/            # деньги, даты
    form/              # разбор ZodError в «поле → сообщение»
    hooks/             # useDebouncedField, useMediaQuery
    ui/                # LinkButton — ссылка в стилях Button
  styles/              # reset.css, tokens.css, globals.css
```

Чего в черновике этого раздела было, а в коде не оказалось:

- **Провайдера темы нет.** Светлая тема живёт только в токенах
  (`styles/tokens.css`, блок `[data-theme="light"]`) и на компонентах не проверена —
  `design-system.md` §10. Вторым контекстом вместо темы стал `ToastContext`.
- **`CarGrid` отдельным компонентом не стал** — сетка каталога это `display: grid`
  на `CatalogPage`, оборачивать её было не во что.
- **`PageContainer` тоже не появился:** поля и максимальная ширина задаёт сама
  страница (`--container-max`, `--container-gutter`), иначе hero главной пришлось бы
  выламывать из контейнера отрицательными margin.

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
    admin-cars/        # каталог в админке: карточки, публикация, удаление (D26)
    storage/           # StorageService над MinIO (S3), MediaController: GET /media/*
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
- Сценарий защиты — [defense.md](defense.md). Распределение ролей не понадобилось: проект делается одним человеком.
