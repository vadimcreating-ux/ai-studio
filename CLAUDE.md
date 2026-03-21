# Инструкции для Claude Code

> **Правило по умолчанию:** если в процессе работы появляются новые соглашения, ограничения или принципы — сразу вноси их в этот файл. CLAUDE.md — единственный источник правды о проекте.

## Когда обновлять CLAUDE.md

Обновляй CLAUDE.md **сразу** при любом из этих изменений:

| Изменение | Примеры |
|---|---|
| Новый/удалённый пакет | добавил `zod`, убрал `zustand` |
| Новый/удалённый файл или модуль | создал `validation.ts`, удалил `DashboardPage.tsx` |
| Новый/изменённый API-роут | новый эндпоинт, изменился формат ответа, добавили пагинацию |
| Новый паттерн или соглашение | способ валидации, rate limit стратегия, SSRF-защита |
| Изменение структуры папок | переименование, перенос, добавление нового слоя |
| Изменение env-переменных | новая переменная, изменилось назначение |
| Изменение роутинга | новый роут, redirect, удалённая страница |
| Изменение схемы БД | новая таблица, новая колонка |
| Изменение стратегии тестирования | новые соглашения, новые скрипты |

**Не нужно** обновлять при: правке логики внутри существующего модуля, фикс багов без архитектурных изменений, обновление стилей/текстов.

> **Напоминание:** любой новый функционал → тесты в `apps/tests/smoke.ts` или `apps/tests/e2e/`. Подробнее — раздел «Тестирование» в конце файла.

---

## Стек технологий

### Backend — `apps/api`
- **Fastify** ^5.0.0 (Node.js + TypeScript, ES modules), `trustProxy: true`
- **PostgreSQL** через `pg` ^8.20.0
- **Zod** — валидация всех входящих данных (`apps/api/src/lib/validation.ts`)
- **@fastify/cors** — CORS (dev: все origins, prod: только `FRONTEND_URL`)
- **@fastify/rate-limit** — rate limit только на дорогих операциях (не глобальный)
- **pino-pretty** (devDep) — красивые логи в dev
- **tsx** для dev, `tsc` для прода
- Точка входа: `apps/api/src/server.ts` (dev/prod)

### Frontend — `apps/web`
- **React** 18.3.1 + **Vite** 5.4.10
- **React Router** v6 (SPA, все роуты → `index.html`)
- **@tanstack/react-query** v5 — весь data fetching (не fetch напрямую)
- **Tailwind CSS** 3.4.14 — весь стайлинг (без inline styles, без CSS-модулей)
- **lucide-react** — иконки
- **react-markdown** + **remark-gfm** — рендеринг Markdown в чате

### Монорепо
- npm workspaces (`apps/*`)
- `npm run dev` — запускает api + web одновременно
- `npm run build` — сначала web, потом api
- `npm run cleanup:test-chats` — удаляет тестовые чаты из БД

---

## Архитектура и деплой

- `apps/api` — backend
- `apps/web` — frontend (в проде раздаётся как статика из `apps/api`)
- БД: PostgreSQL на Timeweb (внешний сервис, не в контейнере)
- Фронт в проде встроен в api: Vite билдит в `apps/web/dist`, Fastify раздаёт статику
- `index.html` отдаётся без кэша (`Cache-Control: no-cache`), остальное — с кэшем

### Стратегия веток и деплоя

```
feature/*, claude/* (фича-ветки)
    ↓ merge когда готово
develop  →  автодеплой на staging (Timeweb App #2)  ← тестируем здесь
    ↓ merge если всё ок
main     →  автодеплой на прод   (Timeweb App #1)   ← реальные пользователи
```

**Правила:**
- Все новые фичи и фиксы разрабатываются в отдельных ветках (`feature/...`, `claude/...`)
- В `develop` мержим когда фича готова к тестированию — деплой на staging происходит автоматически
- В `main` мержим только из `develop` и только после проверки на staging
- **Никогда не пушить напрямую в `main`** без прохождения через staging
- Фича-ветки создаются от `develop`, а не от `main`

**Два приложения на Timeweb App Platform:**

| Приложение | Ветка | Назначение |
|---|---|---|
| Прод | `main` | Реальные пользователи |
| Staging | `develop` | Тестирование перед релизом |

### Переменные окружения (Timeweb dashboard)
```
KIE_API_KEY       # Bearer-токен для KIE API — обязателен
PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD / PGSSLMODE
PORT              # default 3000
NODE_ENV          # "production" в проде (влияет на логи и CORS)
FRONTEND_URL      # опционально — для CORS если фронт на отдельном домене

# Timeweb Object Storage (S3-совместимый)
TIMEWEB_S3_ENDPOINT    # https://s3.timeweb.cloud
TIMEWEB_S3_REGION      # ru-1
TIMEWEB_S3_ACCESS_KEY  # ключ доступа
TIMEWEB_S3_SECRET_KEY  # секретный ключ
TIMEWEB_S3_BUCKET      # имя бакета (должен быть public-read)
```

> Staging и прод используют одни и те же переменные окружения (одну БД). Если нужна изоляция данных — завести отдельную БД для staging и прописать отдельные `PG*` в staging-приложении.

---

## База данных

### Схема — только `apps/api/src/lib/db.ts`

Все изменения схемы — через функции `ensure*Table()` в этом файле. Они вызываются при старте сервера.

### Таблицы

Поле `storage_quota_mb` (default 500) и `storage_used_mb` добавлены в таблицу `users`.

| Таблица | Назначение |
|---|---|
| `chats` | Чаты (module, model, title, project_id) |
| `chat_messages` | Сообщения чатов (role: user/assistant, content) |
| `projects` | Проекты для группировки чатов (system_prompt, memory, context_files) |
| `engine_settings` | Глобальные настройки движков claude/chatgpt/gemini (about, instructions, memory) |
| `files` | Сгенерированные изображения и видео (task_id, url, storage_url, s3_key, file_size_bytes, prompt) |
| `image_prompt_templates` | Шаблоны промптов для изображений |
| `video_prompt_templates` | Шаблоны промптов для видео |

### Правила изменения схемы

1. **Новая таблица** → `CREATE TABLE IF NOT EXISTS`
2. **Новая колонка** → `ALTER TABLE ... ADD COLUMN` + `.catch(() => {})` (колонка может уже существовать на проде)
3. **Никогда** не удалять и не переименовывать колонки — сломает прод с реальными данными
4. **Никогда** не использовать `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` без явного подтверждения пользователя
5. Изменение типа колонки = деструктивная операция, требует подтверждения

```typescript
// Пример безопасного добавления колонки
await dbQuery(`
  ALTER TABLE some_table ADD COLUMN new_field TEXT DEFAULT ''
`).catch(() => {
  // колонка уже существует — это нормально
});
```

---

## KIE API — единственный внешний API, критически важно не менять

Весь AI-функционал идёт исключительно через **KIE API** (`https://api.kie.ai`).
Единственный нужный ключ: `KIE_API_KEY`. Других API-ключей (OpenAI, Google, Anthropic) нет и быть не должно.

Авторизация везде: `Authorization: Bearer ${KIE_API_KEY}`

### Роутинг чатов по движку — `apps/api/src/routes/chat.ts`

Функция `callKieAI()` роутит запрос в зависимости от `chat.module`:

| Движок | KIE эндпоинт | Формат |
|---|---|---|
| `claude` | `POST /claude/v1/messages` | **Anthropic Messages API** |
| `chatgpt` | `POST /{model}/v1/chat/completions` | **OpenAI Chat Completions** |
| `gemini` | `POST /{model}/v1/chat/completions` | **OpenAI Chat Completions** |

#### Claude — Anthropic Messages API
```json
// Запрос — ОБЯЗАТЕЛЬНЫЕ поля: model, messages, max_tokens
// Опциональные: system, tools, thinkingFlag, stream (default: true), output_config
// ⚠️ max_tokens обязателен — KIE возвращает {"code":500} без него (несмотря на отсутствие в их docs)
{
  "model": "claude-sonnet-4-5",
  "messages": [...],
  "system": "...",
  "max_tokens": 8096,
  "stream": false
}
// Ответ — content может содержать блоки типа "text" и "tool_use"
{
  "role": "assistant",
  "content": [{ "type": "text", "text": "..." }],
  "credits_consumed": 0.25,
  "stop_reason": "end_turn",
  "usage": { "input_tokens": 100, "output_tokens": 50 }
}
```

> **⚠️ Критически важно:**
> - Рабочая стабильная модель: `claude-sonnet-4-5`. Модель `claude-sonnet-4-6` нестабильна на стороне KIE — **не использовать**.
> - `max_tokens: 8096` — **обязателен**. KIE возвращает `{"code":500}` без него (несмотря на отсутствие в их docs).
> - **❌ НЕ добавлять** самодельные tools (типа `googleSearch`) — KIE не поддерживает произвольные tool calls для Claude.
> - **❌ НЕ менять** формат на OpenAI Chat Completions — сломает все claude-чаты.
> - Docs: https://docs.kie.ai/market/claude/claude-sonnet-4-5

#### ChatGPT / Gemini — OpenAI Chat Completions
```
POST https://api.kie.ai/{model}/v1/chat/completions
```
```json
// Запрос — system идёт как первый message с role "system"
{ "messages": [{ "role": "system", "content": [{"type":"text","text":"..."}] }, ...], "stream": false }
// Ответ
{ "choices": [{ "message": { "content": "..." } }] }
```

#### Ошибки KIE
KIE может вернуть HTTP 200, но с ошибкой внутри: `{ code: number, msg: string }` — всегда проверяй `data.code !== 200`.

### Image / Video генерация
- Генерация: `POST https://api.kie.ai/api/v1/jobs/createTask`
- Статус: `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=X`
- Улучшение промптов: `POST https://api.kie.ai/gpt-5-2/v1/chat/completions` (OpenAI-формат)
- Баланс: `GET https://api.kie.ai/api/v1/chat/credit`

---

## Роуты и страницы

```
/             → redirect → /claude
/dashboard    → redirect → /claude  (dashboard удалён, будет переделан с нуля)
/claude       → ClaudePage → ChatModule (engine="claude")
/chatgpt      → ChatGPTPage → ChatModule (engine="chatgpt")
/gemini       → GeminiPage → ChatModule (engine="gemini")
/image        → ImagePage
/video        → VideoPage
/files        → FilesPage
/settings     → SettingsPage
```

- Все три чат-движка используют один компонент `ChatModule` — не дублировать логику
- Логотип "AI Studio" в TopNav ведёт на `/claude`

---

## Хранилище файлов (`apps/api/src/lib/s3.ts`)

- S3-клиент для **Timeweb Object Storage** (AWS SDK v3, `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`)
- `uploadToS3(buffer, key, contentType)` → публичный URL; `deleteFromS3(key)` → удаление
- `isS3Configured()` — если env не задан, файлы хранятся только по KIE URL (graceful fallback)
- Квоты: `checkStorageQuota(userId, neededBytes)` в `files-store.ts`. При превышении → HTTP 507
- При удалении файла: S3 delete + декремент `users.storage_used_mb`
- Управление квотой: `PATCH /api/admin/users/:id/storage { storage_quota_mb }` (admin only)

## Структура фронтенда

```
apps/web/src/
├── App.tsx                     # Роуты
├── main.tsx                    # QueryClient + RouterProvider
├── layout/
│   ├── AppLayout.tsx           # Корневой layout (TopNav + Outlet)
│   └── TopNav.tsx              # Горизонтальная навигация + лого
├── modules/chat/               # ChatModule и все его части
│   ├── ChatModule.tsx          # Контейнер (3 панели)
│   ├── ChatView.tsx            # Центр: сообщения + ввод
│   ├── ChatMessage.tsx         # Рендер сообщения (data-role="assistant" на assistant-сообщениях)
│   ├── MessageInput.tsx        # Поле ввода
│   ├── ProjectsPanel.tsx       # Левая панель
│   └── PromptsPanel.tsx        # Правая панель (история чатов, модель как span)
├── pages/                      # Страницы по роутам (DashboardPage удалён)
└── shared/
    ├── api/                    # HTTP-клиенты (chat.ts, projects.ts, ...)
    └── utils/                  # date.ts и др.
```

---

## API эндпоинты (backend)

### Chat
| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/chat/new` | Создать чат |
| GET | `/api/chat/list?module=X&limit=N&offset=N` | Список чатов (с пагинацией, возвращает `total`) |
| GET | `/api/chat/:id/messages` | История сообщений |
| PATCH | `/api/chat/:id` | Обновить model/title/project_id |
| DELETE | `/api/chat/:id` | Удалить чат (cascade messages) |
| POST | `/api/chat/:id/send` | Отправить сообщение → KIE *(rate limit: 30/min)* |
| PATCH | `/api/chat/:id/messages/:msgId` | Редактировать сообщение |
| DELETE | `/api/chat/:id/messages/:msgId` | Удалить сообщение |
| POST | `/api/chat/:id/messages/:msgId/regenerate` | Регенерировать ответ |

### Projects
`GET/POST /api/projects`, `PUT/DELETE /api/projects/:id`

### Images & Videos
`POST /api/image/generate` *(rate limit: 10/min)*, `GET /api/image/status`, `GET /api/image/download`
`POST /api/video/generate` *(rate limit: 5/min)*, `GET /api/video/status`, `GET /api/video/download`

### Files
`GET /api/files?limit=N&offset=N` — список файлов с пагинацией (возвращает `total`)
`DELETE /api/files/:id`

### Прочее
`GET /health`, `GET /api/kie-balance`, `GET/PUT /api/engine-settings/:engine`

### Формат ответа (всегда)
```json
{ "ok": true, "data": ... }
{ "ok": false, "error": "описание ошибки" }
```

---

## Соглашения по коду

### Общие
- TypeScript strict mode везде
- `type Props = { ... }` для пропсов (не `interface`)
- Именование: компоненты — PascalCase, утилиты — camelCase

### Frontend
- **Весь data fetching** — через React Query (`useQuery`, `useMutation`). Не писать fetch напрямую в компонентах
- **Query keys**: `["resource", param1, param2]`
- **Стайлинг** — только Tailwind-классы. Динамические значения через `style={}` только если нельзя иначе
- **Иконки** — только из `lucide-react`
- API-клиенты живут в `shared/api/` и экспортируют объект (`export const chatApi = { ... }`)
- Оптимистичные обновления через `onMutate` / `setOptimisticMessages`

### Backend
- Все роуты регистрируются через `app.register(routesFn)`
- Запросы к БД — только через `dbQuery()` из `apps/api/src/lib/db.ts`
- **Валидация входных данных** — через Zod-схемы из `apps/api/src/lib/validation.ts`. Использовать `.safeParse()`, не `as { ... }`
- **Rate limiting** — `global: false`, лимиты только на дорогих эндпоинтах через `config: { rateLimit: { max, timeWindow } }` в опциях роута. Глобальный rate limit по IP сломан за Timeweb-прокси (shared IP)
- **SSRF защита** — `fetchUrlContent()` в `chat.ts` проверяет URL через `isSafeUrl()`: блокирует localhost, приватные подсети, raw IP, не-http(s) схемы

### Логирование
- Dev (`NODE_ENV != production`): pino-pretty с цветами
- Prod: JSON-логи со структурированными полями `req.method`, `req.url`, `res.statusCode`
- Использовать `app.log.info({ field: value }, "message")` — не `console.log`

---

## Цветовая палитра Tailwind

```javascript
base:          "#0d1117"   // основной фон
panel:         "#161b22"   // фон панелей/карточек
surface:       "#21262d"   // поверхности (кнопки, инпуты)
border:        "#30363d"   // рамки
muted:         "#8b949e"   // вторичный текст
accent:        "#2563eb"   // primary blue
accent-hover:  "#1d4ed8"   // hover blue
```

Эти токены уже настроены в `tailwind.config.js` — использовать их, а не hex напрямую.

---

## Модели по движкам

```typescript
// apps/web/src/modules/chat/PromptsPanel.tsx
claude:  [{ value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" }]
chatgpt: [{ value: "gpt-5-2", label: "GPT-5" }, { value: "gpt-4o", label: "GPT-4o" }]
gemini:  [{ value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" }, { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" }]
```

---

## Тестирование

```bash
npm run test:smoke              # API smoke-тесты (создаёт/удаляет чаты автоматически)
npm run test:e2e                # Playwright E2E (создаёт/удаляет чаты автоматически)
npm run cleanup:test-chats      # Удалить тестовые чаты оставшиеся от упавших тестов
```

### Правило: новый функционал — всегда покрывается тестами

**Это обязательное требование.** При добавлении любого нового функционала Claude Code **всегда** дополняет тесты в рамках той же задачи — не откладывая на потом.

| Тип изменения | Что добавить в тесты |
|---|---|
| Новый API-эндпоинт | Smoke-тест: вызов эндпоинта + проверка структуры ответа |
| Новое поле в ответе существующего эндпоинта | Smoke-тест: `assert` что поле присутствует и имеет нужный тип |
| Новая бизнес-логика (расчёт, трансформация) | Smoke-тест с граничными значениями (0%, 10%, 100% наценка и т.п.) |
| Новый UI-компонент или поведение | E2E-тест: видимость, кликабельность, результат действия |
| Изменение схемы БД | Smoke-тест: что новое поле возвращается через API |

**Где писать тесты:**
- API / backend логика → `apps/tests/smoke.ts` (функции `runXxxTests()`)
- UI / frontend → `apps/tests/e2e/*.spec.ts`

**Что именно проверять в smoke-тестах:**
- Поле существует в ответе (`assert(field !== undefined, ...)`)
- Поле имеет ожидаемый тип (`assert(typeof field === "number", ...)`)
- Бизнес-логика работает верно (наценка применяется, баланс меняется, и т.д.)

### E2E тесты — соглашения
- E2E тесты используют `beforeAll`/`afterAll` для очистки: запоминают существующие chatIds, удаляют только то, что создали сами
- Smoke тесты создают чаты с заголовком `[smoke-test] {module}` и удаляют их в `finally`
- `cleanup:test-chats` удаляет: `[smoke-test]*` чаты + пустые "Новый чат" без сообщений
- E2E тесты запускаются против прода (`TEST_URL` в GitHub Actions), не против feature-ветки
