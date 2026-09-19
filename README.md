# CarShowroom

Сайт автосалона: каталог с фильтрами, страница автомобиля с 3D-просмотром и выбором
цвета кузова, запись на тест-драйв, личный кабинет, обработка записей менеджером.

Учебный проект: практическая работа «Разработка многостраничного сайта на React
с маршрутизацией, регистрацией и авторизацией» (МДК 01.06), расширенная
собственным бэкендом и БД.

## Стек

| Слой | Технологии |
|---|---|
| Frontend | Vite, React 19, TypeScript, React Router (декларативный режим), TanStack Query, CSS Modules + дизайн-токены, React Three Fiber + drei |
| Backend | NestJS, postgres.js (SQL руками), Better Auth, zod |
| БД | PostgreSQL, миграции — SQL-файлы через dbmate |
| Контракт | `packages/contracts` — zod-схемы, общие для фронта и бэка |
| Монорепо | npm workspaces |

## Документация

- [docs/decisions.md](docs/decisions.md) — принятые решения и почему
- [docs/design-plan.md](docs/design-plan.md) — что проектируем до реализации: контент, API, структура фронта и бэка
- [docs/use-cases.md](docs/use-cases.md) — роли, страницы, сценарии, правила тест-драйва
- [docs/db/README.md](docs/db/README.md) — схема БД: таблицы, связи, правила, smoke-тест
- [docs/assignment.md](docs/assignment.md) — выжимка требований ТЗ
