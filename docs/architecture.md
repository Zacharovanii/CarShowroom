# Архитектура

Как устроен CarShowroom: из каких частей состоит, как они общаются и где что хранится.
Почему выбрано именно так — в [decisions.md](decisions.md) (ссылки вида «D5»), роли
и сценарии — в [use-cases.md](use-cases.md), схема БД — в [db/README.md](db/README.md).

## Монорепо

npm workspaces (D2), три пакета, везде TypeScript и ESM (D20):

| Пакет | Что это |
|---|---|
| `apps/web` | SPA на Vite + React (D3): маршрутизация, экраны, 3D-просмотр |
| `apps/api` | NestJS (D4): REST API, авторизация, раздача файлов |
| `packages/contracts` | zod-схемы запросов и ответов, коды ошибок, общие константы |

`apps/web` и `apps/api` зависят от `contracts` и импортируют его сборку (`dist/`),
поэтому контракты собираются первыми (`npm run build -w @carshowroom/contracts`
или `npm run dev:contracts` в режиме watch).

## Контракт API

Единственное описание API — `packages/contracts`. Типы запросов и ответов отдельно
в `apps/web` и `apps/api` не объявляются: фронт и бэк проверяют данные одними и теми же
схемами. Контракт описывает JSON как он есть на проводе: даты и деньги — строки
(деньги — `numeric` в БД, на фронте только форматируются, D12).

- Префикс `/api` — у всех эндпоинтов, кроме раздачи файлов `/assets/*` и `/media/*`.
- Ошибка — единый формат:
  `{ "error": { "code": "SLOT_TAKEN", "message": "...", "details"?: {...} } }`.
  Коды перечислены в `packages/contracts/src/api-errors.ts`; `AppError` в API берёт код
  только оттуда. `INTERNAL_ERROR` — непредвиденный сбой 500.
- Списки — страницами: `page` в запросе, `page`, `pageSize`, `total`, `totalPages` в ответе.
  Размер страницы задаёт контракт: каталог — 6 (`CARS_PAGE_SIZE`), пользователи и
  автомобили в админке — 20.

### Эндпоинты

| Метод | Путь | Доступ | Назначение |
|---|---|---|---|
| GET | `/api` | все | проверка, что API жив (healthcheck в compose) |
| * | `/api/auth/*` | — | Better Auth: sign-up/email, sign-in/email, sign-out, get-session, update-user, change-password; письма (D27): send-verification-email, verify-email (`GET ?token=`), request-password-reset, reset-password |
| GET | `/api/catalog/filters` | гость | справочники для фильтров: серии, кузова, типы двигателя (`id`, `name`, `position`) |
| GET | `/api/cars` | гость | каталог: `q`, `series`, `body`, `fuel` (id из справочников), `drive`, `priceMin`, `priceMax`, `sort`, `page` |
| GET | `/api/cars/:slug` | гость | автомобиль: характеристики, цена, фото, палитра, путь к GLB; черновик → 404 `NOT_FOUND` |
| GET | `/api/cars/:slug/slots` | гость | `date` → 9 слотов дня со статусом свободен / занят / недоступен; черновик → 404 |
| GET | `/api/me/test-drives` | клиент | свои записи: предстоящие и история |
| POST | `/api/me/test-drives` | клиент | `carId`, `startsAt`, `phone`, `comment?` → 409 `SLOT_TAKEN`, 422 `TOO_MANY_ACTIVE`, черновик → 404 |
| POST | `/api/me/test-drives/:id/cancel` | клиент | отмена своей будущей записи |
| GET | `/api/manager/test-drives` | менеджер, админ | `date`, `carId?`, `status?` → записи дня с клиентом |
| PATCH | `/api/manager/test-drives/:id` | менеджер, админ | `status`: `completed` / `no_show` / `cancelled` + `cancelReason` |
| GET | `/api/admin/users` | админ | `q?`, `role?`, `page` — список пользователей |
| POST | `/api/admin/users` | админ | `name`, `email`, `phone`, `password` → менеджер |
| GET | `/api/admin/cars` | админ | `q?` (название, slug), `status?` (`all` / `published` / `draft`), `page` — список вместе с черновиками |
| GET | `/api/admin/cars/options` | админ | справочники для формы: серии, кузова, типы двигателя, цвета |
| GET | `/api/admin/cars/:id` | админ | карточка для редактирования: id справочников, `colorIds`, фото, модель, `isPublished`, `testDrivesCount` |
| POST | `/api/admin/cars` | админ | поля автомобиля, `slug`, `colorIds` → 201, черновик; 409 `SLUG_TAKEN`, `NAME_TAKEN` |
| PATCH | `/api/admin/cars/:id` | админ | любые поля; `colorIds` заменяет палитру целиком → 409 `SLUG_TAKEN`, `NAME_TAKEN` |
| POST | `/api/admin/cars/:id/publish` | админ | опубликовать; повтор — 200 без изменений; нет ни одного фото → 409 `CAR_NOT_READY` |
| POST | `/api/admin/cars/:id/unpublish` | админ | снять с публикации; повтор — 200 без изменений |
| DELETE | `/api/admin/cars/:id` | админ | удалить вместе с файлами в MinIO → 204; есть записи в любом статусе → 409 `CAR_HAS_TEST_DRIVES` |
| POST | `/api/admin/cars/:id/images` | админ | multipart `file`, `alt` → 201, фото в конец |
| PUT | `/api/admin/cars/:id/images/:imageId/file` | админ | multipart `file` — заменить файл; `position` и `alt` не меняются |
| PATCH | `/api/admin/cars/:id/images/:imageId` | админ | `alt` |
| PUT | `/api/admin/cars/:id/images/order` | админ | `imageIds` — полный новый порядок, ровно текущие фото → иначе 400 `VALIDATION_FAILED` |
| DELETE | `/api/admin/cars/:id/images/:imageId` | админ | удалить, позиции сдвигаются без дыр; последнее фото опубликованного → 409 `LAST_IMAGE` |
| PUT | `/api/admin/cars/:id/model` | админ | multipart `file` (GLB), `paintMaterial` (`CarPaint` по умолчанию) → 400 `PAINT_MATERIAL_NOT_FOUND` |
| DELETE | `/api/admin/cars/:id/model` | админ | убрать модель |
| GET | `/media/*` | все | загруженный админом файл из MinIO, `Cache-Control: immutable` |

### Коды ошибок

- Тест-драйвы: `SLOT_TAKEN` (409), `TOO_MANY_ACTIVE`, `SLOT_OUT_OF_RANGE`,
  `SLOT_NOT_ON_GRID`, `ALREADY_CLOSED`, `TOO_LATE_TO_CANCEL`, `SLOT_NOT_STARTED` (422).
  Результат визита отмечается только после начала слота, отмена — только до (UC-M2).
- Общие: `EMAIL_TAKEN`, `NOT_FOUND`, `FORBIDDEN`, `VALIDATION_FAILED`.
- Каталог в админке (D26): `SLUG_TAKEN`, `NAME_TAKEN`, `CAR_HAS_TEST_DRIVES`,
  `CAR_NOT_READY`, `LAST_IMAGE` (409); `INVALID_FILE`, `PAINT_MATERIAL_NOT_FOUND`
  (400, в `details.materials` — имена материалов из файла); `FILE_TOO_LARGE` (413).
  `CAR_NOT_READY` и `LAST_IMAGE` — две стороны одного правила «у опубликованного
  автомобиля есть хотя бы одно фото». Ошибки файла отделены от `VALIDATION_FAILED`,
  чтобы форма показала их у поля загрузки.
- Better Auth (разбирает `features/auth/authErrors.ts`): `INVALID_EMAIL_OR_PASSWORD`
  (401), `EMAIL_NOT_VERIFIED` (403), ссылка подтверждения — `INVALID_TOKEN` /
  `TOKEN_EXPIRED` / `USER_NOT_FOUND` (401), ссылка сброса пароля — `INVALID_TOKEN` (400),
  429 без кода — слишком частые запросы.

Схемы тел запросов к `/api/auth/*` тоже в контракте (`packages/contracts/src/auth.ts`),
парой «запрос + форма», если у формы есть поле подтверждения: `signUpSchema` /
`signUpFormSchema`, `resetPasswordSchema` / `resetPasswordFormSchema` и т.д.

### Загрузка файлов

`multipart/form-data` через Nest, поле `file` (+ `alt` у фото, + `paintMaterial`
у модели). Лимиты: фото 10 МБ (JPEG, PNG, WebP, AVIF), модель 60 МБ (GLB 2.0). Формат
проверяется по сигнатуре файла, а не по `mimetype` от клиента; у GLB API дополнительно
разбирает JSON-чанк и ищет материал `paintMaterial`. Все мутации карточки, фото и модели
возвращают полную админскую карточку — фронт кладёт её в кеш без второго запроса.

## Бэкенд

```
apps/api/
  db/
    migrations/        # dbmate, чистый SQL
    schema.sql         # дамп схемы от dbmate
    seed/              # каталог (SQL), тестовые пользователи и записи, promote-admin
  http/                # .http-сценарии для ручной проверки
  public/assets/       # CC0-заглушки и HDRI (в репозитории)
  licensed-assets/     # настоящие модели и фото (вне гита, D25)
  src/
    main.ts            # префикс /api, раздача /assets, shutdown hooks
    config/            # env через zod: при неверном конфиге API не стартует
    db/                # DatabaseModule: postgres.js, закрытие пула
    auth/              # Better Auth: свой pg Pool, роли, письма, лимиты частоты
    mail/              # отправка через Resend; без ключа — ссылка в лог
    common/            # ZodValidationPipe, AppError, фильтр ошибок
    catalog/           # справочники и каталог
    test-drives/       # правила (rules.ts), сетка слотов, запись, отмена
    manager/           # записи дня, смена статуса
    admin/             # пользователи, создание менеджера
    admin-cars/        # каталог в админке, проверка файлов (file-checks.ts)
    storage/           # StorageService над MinIO, GET /media/*
  test/                # e2e: Vitest + supertest
```

Слои внутри модуля:

- **Repository** — только SQL (postgres.js, без ORM, D5), принимает `sql | tx`,
  возвращает строки. Колонки БД — snake_case, в код приходят в camelCase
  (`transform: postgres.camel`).
- **Service** — правила и транзакции (`sql.begin`), бросает `AppError` с кодом
  из контракта.
- **Controller** — валидация через `ZodValidationPipe`, маппинг строк в контракт,
  `@Session()` для текущего пользователя.

Гонки решает БД, а не предварительный `select`: нарушение уникального индекса
(23505) переводится в код ошибки — слот в `SLOT_TAKEN`, slug и название в `SLUG_TAKEN`
и `NAME_TAKEN`; нарушение внешнего ключа при удалении автомобиля с записями —
в `CAR_HAS_TEST_DRIVES`. Какие правила держит БД, а какие API, — в
[db/README.md](db/README.md#что-держит-бд-а-что-api).

## Фронтенд

```
apps/web/src/
  app/                 # App (провайдеры: QueryClient, AuthProvider, ToastProvider,
                       #   BrowserRouter), AppRoutes — карта маршрутов
  pages/               # страницы-маршруты: тонкие, собирают фичи; admin/, account/
  features/
    auth/              # authClient (Better Auth), контекст сессии, ProtectedRoute,
                       #   формы входа, регистрации, профиля, пароля, письма; authErrors
    catalog/           # список, поиск, фильтры, карточка
    car/               # страница автомобиля: медиа, галерея, характеристики
    car-viewer/        # 3D: сцена, модель, окружение, выбор цвета (грузится лениво)
    test-drives/       # выбор дня и слота, запись, «Мои записи», отмена
    manager/           # записи дня, фильтры, смена статуса
    admin/             # пользователи, создание менеджера
    admin-cars/        # управление каталогом: список, карточка, фото, модель
  components/
    ui/                # примитивы дизайн-системы
    layout/            # RootLayout, Header, Footer
  shared/
    api/               # fetch-клиент: база, ошибки из contracts, cookies, multipart
    format/            # деньги и даты
    form/              # разбор ZodError в «поле → сообщение»
    hooks/             # useDebouncedField, useMediaQuery
    ui/                # LinkButton — ссылка в стилях Button
  styles/              # reset.css, tokens.css, globals.css
```

Правила:

- **Серверное состояние** — только TanStack Query; ключи запросов — фабрикой в фиче.
- **Глобальное клиентское** — два контекста: сессия (`AuthProvider`) и тосты. Отдельного
  стора нет. `isPending` в контексте сессии — только **первая** проверка: Better Auth
  поднимает свой `isPending` при каждом перечитывании сессии, и гостевые формы
  размонтировались бы вместе с вводом.
- **Фильтры каталога** — в URL (`useSearchParams`): ссылкой можно поделиться, «назад»
  возвращает прежний выбор, а синхронизировать URL и состояние через `useEffect`
  не нужно — URL и есть состояние.
- **Формы** — контролируемые инпуты и `safeParse` схемой из контракта; ошибки zod
  раскладываются по полям (`shared/form`). Библиотеки форм нет.
- Страница не ходит в API напрямую — только через хуки фичи. Фича не импортирует
  другую фичу, кроме `auth` (нужен текущий пользователь).
- **Стили** — CSS Modules и токены из `styles/tokens.css`, без хардкода значений (D10);
  справочник — [design-system.md](design-system.md).
- Роль проверяет бэкенд; фронт (`ProtectedRoute`) лишь прячет недоступное.

В dev Vite проксирует `/api`, `/assets` и `/media` на API, поэтому фронт и API для
браузера живут на одном origin, как и на сервере.

## 3D

Просмотр модели — React Three Fiber + drei (D11). Пакеты three.js вынесены в отдельный
чанк и грузятся только при открытии вкладки «3D» (`React.lazy`, граница —
`CarScene.tsx`): посетитель, который не смотрит модель, их не скачивает. Управление —
`CameraControls`, тени — `ContactShadows`, окружение — HDRI-панорамы из
`/assets/hdri`. Цвет кузова меняется перекраской материала с именем
`paintMaterial` (по умолчанию `CarPaint`); на цену он не влияет. Нет WebGL или модель
не загрузилась — остаётся галерея фото.

## Хранение и раздача файлов

Путь к файлу хранится в БД целиком (`car_images.path`, `cars.model_3d_path`); фронт
подставляет его как есть и источники не различает.

| Префикс | Откуда | Кто раздаёт |
|---|---|---|
| `/assets/...` | `apps/api/licensed-assets/` (вне гита), иначе `apps/api/public/assets/`; нет файла — заглушка `placeholder-car.webp` / `.glb` | Nest, статикой (D15.1, D25) |
| `/media/...` | загруженное админом — приватный бакет MinIO, ключ с uuid | Nest, `MediaController` (D26) |
| `/static/...`, остальное | сборка фронта | Caddy (на сервере) или Vite (в dev) |

Благодаря подмене на заглушки чистый клон без `licensed-assets` даёт рабочий сайт
с полным каталогом. MinIO наружу не открыт; файл по ключу не меняется, поэтому
`/media` отдаётся с долгим кешем. Файлы в MinIO удаляет API после коммита транзакции,
которая перестала на них ссылаться (подробнее — [db/README.md](db/README.md)).

## Авторизация

Better Auth (D7) внутри модуля `auth`, со своим `pg` Pool — единственное исключение
из правила «SQL через postgres.js». Пулы разделены по размеру: 5 соединений у Better Auth,
10 у остального кода (D7.1). Сессия — cookie; Better Auth сверяет заголовок `Origin`
со списком доверенных (`BETTER_AUTH_URL` и `WEB_ORIGIN`).

- **Роли** (D16): `user`, `manager`, `admin` — admin-плагин Better Auth. Все маршруты
  закрыты глобальным guard; публичные помечены `@AllowAnonymous()`, ролевые —
  `@Roles([...])` на контроллере. `@Roles` сверяет роль буквально, поэтому доступ админа
  к экрану менеджера перечислен явно (`["manager", "admin"]`).
- **Подтверждение email и сброс пароля** (D27): вход без подтверждённого email —
  403 `EMAIL_NOT_VERIFIED` и новое письмо; ссылки живут 1 час; сброс пароля закрывает
  все сессии пользователя. Письма отправляет модуль `mail` через Resend; без ключа
  ссылка пишется в лог API, в тестах письма читаются из памяти процесса.
- **Ограничение частоты**: вход и регистрация — 5 в минуту, письма — 3 в минуту, иначе
  429. Клиента Better Auth определяет по `X-Forwarded-For`, поэтому на сервере его
  выставляет прокси перед API (Caddy), а сам API наружу не открыт.
- **Админ** через интерфейс не назначается: в dev он есть в seed, на сервере роль
  выдаёт `npm run db:promote-admin` зарегистрированному пользователю (D28).

Проверять авторизацию вручную (curl, `.http`) нужно с `Origin` фронта: запрос с `Origin`
самого API проходит, хотя из браузера тот же вход получил бы 403 `INVALID_ORIGIN`.

## Тесты

Только бэкенд: Vitest + supertest, `npm test -w @carshowroom/api`.

- **Юнит** — правила тест-драйва (сетка слотов, горизонт, лимит, переходы статусов),
  пути `/media`, проверка файлов по сигнатуре.
- **e2e** (`apps/api/test`) — регистрация с подтверждением email и сброс пароля (письма
  из памяти процесса), каталог с фильтрами, двойная запись на слот → 409, права ролей,
  управление каталогом с загрузкой файлов.

Отдельной тестовой БД нет: тесты работают с той же базой и MinIO, что и dev (`DATABASE_URL`
из `apps/api/.env`), рассчитывают на применённые миграции и seed и удаляют за собой
созданные строки (по префиксу `e2e-` в email и slug). Лимиты частоты в тестах выключены.
У фронта автотестов нет; его проверяют `typecheck`, `lint` и сборка.

## Развёртывание

Один VPS, docker compose (`docker/compose.prod.yml`, D28):

```
браузер ──HTTPS──▶ caddy (80, 443) ──▶ api (Nest, :3000) ──▶ db (Postgres)
                   статика SPA                          └──▶ minio (загруженные файлы)
```

Caddy получает сертификат Let's Encrypt, отдаёт собранный фронт и проксирует в API
`/api`, `/media` и `/assets`. Фронт и API на одном origin, поэтому CORS и `WEB_ORIGIN`
на сервере не нужны. Наружу открыты только порты Caddy. Миграции применяет одноразовый
сервис `migrate` (dbmate) до запуска API. Пошаговая инструкция —
[deploy.md](deploy.md).
