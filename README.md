# AI Studio

Веб-интерфейс для работы с несколькими AI-модулями через KIE API.

## Стек

- **Backend** — Fastify + TypeScript (`apps/api`)
- **Frontend** — React 18 + Vite + Tailwind CSS (`apps/web`)
- **БД** — PostgreSQL (внешний сервис на Timeweb)
- **AI** — KIE API (Claude, ChatGPT, Gemini, Image, Video)

## Структура монорепо

```
apps/
├── api/   # Fastify backend, раздаёт и фронт в проде
└── web/   # React SPA
```

## Запуск

```bash
npm install
npm run dev      # запускает api + web одновременно
npm run build    # сначала web, потом api
```

## Стратегия веток и деплоя

```
feature/*, claude/* (фича-ветки)
    ↓ merge когда готово
develop  →  автодеплой на staging  ← тестируем здесь
    ↓ merge если всё ок
main     →  автодеплой на прод     ← реальные пользователи
```

**Правила:**
- Фича-ветки создаются от `develop`
- В `develop` мержим когда фича готова к тестированию
- В `main` мержим только из `develop` после проверки на staging
- **Никогда не пушить напрямую в `main`**

**Два приложения на Timeweb App Platform:**

| Приложение | Ветка | URL |
|---|---|---|
| Прод | `main` | основной домен |
| Staging | `develop` | staging-домен |

## База данных

PostgreSQL — отдельный сервис на Timeweb (не в контейнере). Схема управляется через функции `ensure*Table()` в `apps/api/src/lib/db.ts`.

**Правила изменения схемы:**
- Новые таблицы: `CREATE TABLE IF NOT EXISTS`
- Новые колонки: `ALTER TABLE ... ADD COLUMN` + `.catch(() => {})` (колонка может уже существовать)
- Нельзя удалять/переименовывать колонки без явного подтверждения

## Переменные окружения

```
KIE_API_KEY       # Bearer-токен для KIE API — обязателен
PGHOST            # хост PostgreSQL
PGPORT            # порт PostgreSQL
PGDATABASE        # имя базы данных
PGUSER            # пользователь
PGPASSWORD        # пароль
PGSSLMODE         # режим SSL (обычно require)
PORT              # порт сервера (default 3000)
HTTPS_PROXY       # опционально, для обхода гео-блокировки
```
