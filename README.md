# CarShowroom

Учебный сайт дилерского центра BMW — не официальный сайт BMW (пометка об этом стоит
в подвале). Каталог автомобилей с фильтрами, страница автомобиля с 3D-просмотром
и выбором цвета кузова, запись на тест-драйв, личный кабинет, обработка записей
менеджером, управление пользователями и каталогом в админке.

Проект выполнен как практическая работа «Разработка многостраничного веб-сайта на React
с маршрутизацией, регистрацией и авторизацией» (МДК 01.06) и расширен собственным
бэкендом, БД, 3D-просмотром, админкой и выкаткой на сервер.

## Возможности

- **Каталог:** поиск, фильтры по серии, кузову, двигателю, приводу и цене, сортировка;
  фильтры хранятся в URL.
- **Страница автомобиля:** галерея, характеристики, 3D-модель с перекраской кузова.
- **Тест-драйв:** выбор дня и часового слота, запись, «Мои записи», отмена.
- **Аккаунт:** регистрация с подтверждением email, вход, восстановление пароля письмом,
  профиль, смена пароля.
- **Менеджер:** записи на день, фильтры, отметка результата или отмена с причиной.
- **Админ:** пользователи и создание менеджеров; карточки автомобилей, публикация,
  загрузка фото и 3D-моделей.
- **Авто с пробегом** (`/used/`, только в dev): отдельный раздел на Django + Bootstrap
  со своей SQLite и админкой Django — практическая работа по Django,
  [apps/used-cars/README.md](apps/used-cars/README.md).

## Стек

| Слой | Технологии |
|---|---|
| Frontend | Vite, React 19, TypeScript, React Router (декларативный режим), TanStack Query, CSS Modules + дизайн-токены, Radix UI, React Three Fiber + drei |
| Backend | NestJS, postgres.js (SQL руками), Better Auth, zod, Resend (почта) |
| Данные | PostgreSQL, миграции dbmate (чистый SQL), MinIO (S3) для загруженных файлов |
| Контракт | `packages/contracts` — zod-схемы, общие для фронта и бэка |
| Инфраструктура | npm workspaces, Docker Compose, Caddy (HTTPS на сервере) |
| Тесты | Vitest + supertest (API) |

## Структура репозитория

```
apps/web/            SPA (Vite + React)
apps/api/            REST API (NestJS), миграции, seed, заглушки ассетов
apps/used-cars/      раздел «Авто с пробегом» (Django, uv, SQLite)
packages/contracts/  zod-схемы API
docker/              compose для dev и прода, Caddyfile
docs/                документация
```

Подробно — [docs/architecture.md](docs/architecture.md).

## Быстрый старт

Нужны Node.js 24+, npm и Docker.

```bash
npm install
cp apps/api/.env.example apps/api/.env      # значения совпадают с docker/compose.yml
npm run db:up                               # Postgres :5434, Adminer :8080, MinIO :9000/:9001
npm run build -w @carshowroom/contracts     # контракты нужны и API, и фронту
npm run db:migrate                          # схема БД (dbmate)
npm run db:seed                             # каталог, тестовые пользователи и записи
npm run dev:api                             # API: http://localhost:3000
npm run dev:web                             # сайт: http://127.0.0.1:5173
```

`npm run dev:contracts` пересобирает контракты при изменениях. Фронту `.env` в dev
не нужен: запросы к `/api`, `/assets` и `/media` Vite проксирует на API
(`apps/web/.env.example` — только для сборки под другой хост).

**Учётные записи из seed** (только для dev, пароль у всех `password123`):

| Роль | Email |
|---|---|
| Клиент | `client@carshowroom.test` |
| Менеджер | `manager@carshowroom.test` |
| Админ | `admin@carshowroom.test` |

Остальные команды: `npm run db:down` — остановить контейнеры;
`npm run db:promote-admin -- <email>` — выдать роль админа зарегистрированному
пользователю с подтверждённым email (локально; на сервере — [deploy.md](docs/deploy.md) §10).

Adminer (просмотр БД): http://localhost:8080 — система PostgreSQL, сервер `db`,
пользователь, пароль и база `carshowroom`. Консоль MinIO: http://localhost:9001
(`carshowroom` / `carshowroom123`); бакет создаёт сервис `minio-init` при `db:up`.

### Почта

Регистрация требует подтверждения email, пароль восстанавливается письмом (D27). Письма
отправляет API через [Resend](https://resend.com), переменные — в `apps/api/.env`:

| Переменная | Что это |
|---|---|
| `RESEND_API_KEY` | ключ API — в панели Resend, раздел API Keys |
| `MAIL_FROM` | отправитель: `CarShowroom <noreply@ваш-домен>` |

**В dev ключ не нужен.** Без `RESEND_API_KEY` письма не уходят: ссылка подтверждения
или сброса пароля пишется в лог API строкой `[Mail]` — её достаточно открыть в браузере.
Seed-учётки и менеджеры, созданные админом, уже подтверждены. Если ключ задан, dev-сервер
шлёт настоящие письма (и тогда нужен `MAIL_FROM`); тесты не шлют писем никогда.

**На сервере** обе переменные обязательны, без них API не стартует. Тестовый отправитель
`onboarding@resend.dev` доставляет только на адрес владельца аккаунта Resend; для
реальных адресов нужен свой домен, подтверждённый в Resend записями SPF и DKIM.

### Типичные проблемы в dev

| Симптом | Причина и решение |
|---|---|
| Вход отвечает 403 `INVALID_ORIGIN` | в `apps/api/.env` нет `WEB_ORIGIN` с адресом фронта — поправить и перезапустить API |
| Каталог пустой | не выполнен `npm run db:seed` |
| Фото и модели не грузятся | не запущен API: `/assets` и `/media` раздаёт он |
| Вместо фото «Фото не установлено», в 3D — серый седан | нет `apps/api/licensed-assets/` — это нормально, см. «Ассеты и лицензии» |
| Запись не проходит: «слишком много активных записей» | у клиента уже две будущие записи (TD-6) — отменить одну в кабинете |

## Проверки

```bash
npm run typecheck                 # tsc во всех пакетах
npm run lint                      # ESLint
npm run build                     # сборка всех пакетов
npm test -w @carshowroom/api      # юнит- и e2e-тесты API
```

`npm run format` форматирует код Prettier. Тесты API работают с той же локальной базой
и MinIO, что и dev: перед запуском нужны `db:up`, миграции и seed (подробнее — в
[architecture.md](docs/architecture.md#тесты)).

## Ассеты и лицензии

В репозитории — только свободные файлы в `apps/api/public/assets/`: седан-заглушка
`placeholder-car.glb` (Quaternius, CC0, [Poly Pizza](https://poly.pizza/m/Cz6yDaUcM9)),
картинка «Фото не установлено» `placeholder-car.webp` (CC0) и HDRI-панорамы для 3D-сцены
`hdri/canary_wharf_2k.hdr`, `hdri/urban_street_01_2k.hdr` (Andreas Mischok, CC0,
[Poly Haven](https://polyhaven.com)). Этого хватает, чтобы чистый клон работал
с полным каталогом.

Настоящие 3D-модели (Sketchfab, лицензии Creative Commons только для некоммерческого
использования) и фотографии (лицензия не установлена) в репозиторий не входят (D25).
Если они есть, они лежат в `apps/api/licensed-assets/` и перекрывают заглушки без
перезапуска: `models/{slug}.glb`, `cars/{slug}-{n}.jpg`, где `slug` — из
`apps/api/db/seed/catalog.sql`, `-1` — обложка. BMW — товарный знак BMW AG.

## Выкатка на сервер

Один VPS: docker compose (`docker/compose.prod.yml`), Caddy с автоматическим HTTPS
перед API, Postgres и MinIO. Пошагово — [docs/deploy.md](docs/deploy.md), почему так —
D28 в [docs/decisions.md](docs/decisions.md).

## Документация

- [docs/architecture.md](docs/architecture.md) — как устроена система: пакеты, контракт и эндпоинты, слои, файлы, авторизация, тесты, деплой
- [docs/decisions.md](docs/decisions.md) — журнал решений (D1…D29): контекст, решение, последствия
- [docs/use-cases.md](docs/use-cases.md) — роли, страницы, сценарии, правила тест-драйва
- [docs/db/README.md](docs/db/README.md) — схема БД: таблицы, связи, ограничения
- [docs/design-system.md](docs/design-system.md) — токены, правила и компоненты интерфейса
- [docs/deploy.md](docs/deploy.md) — выкатка на сервер, пошагово

## Учебный проект: выбор инструментов

Проект учебный, поэтому часть инструментов выбрана, чтобы их освоить, а не только
потому, что они проще всего решают задачу:

- **NestJS** — фреймворк для бэкенда с модулями, DI и guards; бэкенд на TypeScript,
  как и фронт (D4).
- **postgres.js без ORM** — явный контроль над SQL и работой с БД без абстракций ORM (D5).
- **CSS Modules + токены вместо Tailwind** — собственная дизайн-система без готовых
  утилитарных классов, компоненты без CSS в разметке (D10).
- **React Three Fiber** — 3D-сцена декларативно, в компонентах React (D11).
- **Caddy** — reverse proxy с автоматическим HTTPS, проще в настройке, чем nginx (D28).

Обратный пример — **Better Auth**: авторизация взята готовой, потому что цель проекта —
не писать её с нуля (D7).
