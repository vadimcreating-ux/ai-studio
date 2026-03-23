# syntax=docker/dockerfile:1

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./

# Install ALL deps (devDeps нужны для сборки: tsc, vite, tailwind...)
RUN npm ci

COPY . .

# Собрать frontend (Vite) и backend (tsc)
RUN npm run build

# Удалить dev-зависимости — оставить только prod
RUN npm prune --omit=dev

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

WORKDIR /app

# Копируем package.json для npm start
COPY package.json ./

# Копируем уже установленные prod-зависимости из builder (без сети)
COPY --from=builder /app/node_modules ./node_modules

# Скомпилированный backend
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Собранный frontend (раздаётся как статика из Fastify)
COPY --from=builder /app/apps/web/dist ./apps/web/dist

EXPOSE 3000

CMD ["npm", "run", "start"]
