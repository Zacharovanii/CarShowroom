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

## Модели и фото автомобилей (обязательный шаг)

Настоящие 3D-модели и фото в репозиторий не входят (D25): модели лицензированы только
для некоммерческого использования, у фото лицензия не установлена. Без них сайт
работает, но вместо фото показывается «Фото не установлено», а в 3D — CC0-седан-заглушка.

1. Взять архив `licensed-assets` у владельца проекта. Откуда каждый файл —
   в [docs/assets-licenses.md](docs/assets-licenses.md); модели скачиваются с Sketchfab
   под своим аккаунтом.
2. Положить его в `apps/api/licensed-assets/` так, чтобы получилось:
   ```
   apps/api/licensed-assets/models/m4-competition.glb    (18 файлов, ~200 МБ)
   apps/api/licensed-assets/cars/m4-competition-1.jpg    (85 файлов)
   ```
   Имена файлов — `slug` автомобиля из `apps/api/db/seed/catalog.sql`.
3. Перезапускать ничего не нужно. Проверка: `/assets/models/m4-competition.glb` весит
   ~11 МБ (заглушка — 165 КБ), на `/catalog/m4-competition` видно настоящее фото.

На сервере — то же самое: каталог копируется рядом с `dist/` API при выкатке.

## Документация

- [docs/decisions.md](docs/decisions.md) — принятые решения и почему
- [docs/design-plan.md](docs/design-plan.md) — что проектируем до реализации: контент, API, структура фронта и бэка
- [docs/use-cases.md](docs/use-cases.md) — роли, страницы, сценарии, правила тест-драйва
- [docs/db/README.md](docs/db/README.md) — схема БД: таблицы, связи, правила, smoke-тест
- [docs/assignment.md](docs/assignment.md) — выжимка требований ТЗ
