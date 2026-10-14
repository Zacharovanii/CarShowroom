# Прод-сборка (см. docker/compose.prod.yml): один Dockerfile, три цели.
#   api — Nest с prod-зависимостями, миграциями и seed;
#   web — Caddy со статикой SPA, проксирует /api, /media, /assets в api;
#   used-cars — Django-раздел «Авто с пробегом» (gunicorn), его статика — в web.

# --- сборка всего монорепо ---------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app

# Сначала только манифесты: слой с npm ci пересобирается, лишь когда
# меняются зависимости, а не на каждую правку кода.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci

COPY . .
RUN npm run build -w @carshowroom/contracts \
 && npm run build -w @carshowroom/api \
 && npm run build -w @carshowroom/web

# --- рантайм API ---------------------------------------------------------------
FROM node:24-alpine AS api
WORKDIR /app
ENV NODE_ENV=production

# Только prod-зависимости api; @carshowroom/contracts ставится симлинком
# на packages/contracts, его dist копируется ниже. --omit=optional: better-auth
# объявляет vitest необязательным peer, и без флага в образ едет vitest
# вместе с vite и rolldown (уходит ещё только pg-cloudflare, Node он не нужен).
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
RUN npm ci --omit=dev --omit=optional --workspace=@carshowroom/api && npm cache clean --force

COPY --from=build /app/packages/contracts/dist packages/contracts/dist
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/public apps/api/public
# Миграции и seed: seed запускается из этого образа
# (docker compose ... run --rm api node db/seed/run.mjs).
COPY apps/api/db apps/api/db

USER node
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]

# --- Django-раздел «Авто с пробегом» (D29) ----------------------------------
FROM python:3.13-slim AS used-cars
COPY --from=ghcr.io/astral-sh/uv:0.8.14 /uv /usr/local/bin/uv
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PYTHONUNBUFFERED=1 PATH="/app/.venv/bin:$PATH"

# Зависимости отдельным слоем: строго по uv.lock, пересобирается только
# при смене зависимостей.
COPY apps/used-cars/pyproject.toml apps/used-cars/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY apps/used-cars/ ./
# Статика собирается в образ, а не на старте: её забирает образ Caddy (цель web)
RUN python manage.py collectstatic --noinput

# База и фото — в томах (docker/compose.prod.yml). Каталоги создаются заранее
# с владельцем app: пустой том при первом подключении берёт их права.
# --create-home: gunicorn держит служебный сокет в домашнем каталоге
RUN useradd --system --create-home app && mkdir -p data media && chown app data media
USER app
EXPOSE 8000
# Миграции — при каждом старте: SQLite принадлежит только этому сервису,
# применённые migrate пропускает, отдельный шаг выкатки не нужен.
CMD ["sh", "-c", "python manage.py migrate --noinput && exec gunicorn config.wsgi --bind 0.0.0.0:8000 --workers 2 --access-logfile -"]

# --- Caddy со статикой фронта ------------------------------------------------
FROM caddy:2.11.7-alpine AS web
COPY --from=build /app/apps/web/dist /srv
# Статика Django-раздела (CSS приложения и админки): /used/static/* отдаёт Caddy
COPY --from=used-cars /app/staticfiles /srv/used/static
COPY docker/Caddyfile /etc/caddy/Caddyfile
