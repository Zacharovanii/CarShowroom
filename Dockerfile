# Прод-сборка (см. docker/compose.prod.yml): один Dockerfile, две цели.
#   api — Nest с prod-зависимостями, миграциями и seed;
#   web — Caddy со статикой SPA, проксирует /api, /media, /assets в api.

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

# --- Caddy со статикой фронта ------------------------------------------------
FROM caddy:2.11.7-alpine AS web
COPY --from=build /app/apps/web/dist /srv
COPY docker/Caddyfile /etc/caddy/Caddyfile
