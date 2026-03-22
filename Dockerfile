# syntax=docker/dockerfile:1

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./

# Install ALL deps (devDeps нужны для сборки: tsc, vite, tailwind...)
RUN --mount=type=cache,target=/root/.npm \
    npm ci

COPY . .

# Собрать frontend (Vite) и backend (tsc)
RUN npm run build

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

WORKDIR /app

COPY package.json package-lock.json ./

# Только prod-зависимости: fastify, pg, bcryptjs, zod и плагины
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# Скомпилированный backend
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Собранный frontend (раздаётся как статика из Fastify)
COPY --from=builder /app/apps/web/dist ./apps/web/dist

EXPOSE 3000

CMD ["npm", "run", "start"]
