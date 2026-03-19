# Инструкции для Claude Code

> **Правило по умолчанию:** если в процессе работы появляются новые соглашения, ограничения или принципы — сразу вноси их в этот файл. CLAUDE.md — единственный источник правды о проекте.

---

## Стек технологий

### Backend — `apps/api`
- **Fastify** ^5.0.0 (Node.js + TypeScript, ES modules)
- **PostgreSQL** через `pg` ^8.20.0
- **tsx** для dev, `tsc` для прода
- Точка входа: `apps/api/src/index.ts` (dev) / `apps/api/src/app.ts` (prod)

### Frontend — `apps/web`
- **React** 18.3.1 + **Vite** 5.4.10
- **React Router** v6 (SPA, все роуты → `index.html`)
- **@tanstack/react-query** v5 — весь data fetching (не zustand, не fetch напрямую)
- **Tailwind CSS** 3.4.14 — весь стайлинг (без inline styles, без CSS-модулей)
- **lucide-react** — иконки
- **react-markdown** + **remark-gfm** — рендеринг Markdown в чате

### Монорепо
- npm workspaces (`apps/*`)
- `npm run dev` — запускает api + web одновременно
- `npm run build` — сначала web, потом api

---

## Архитектура и деплой

- `apps/api` — backend
- `apps/web` — frontend (в проде раздаётся как статика из `apps/api`)
- БД: PostgreSQL на Timeweb (внешний сервис, не в контейнере)
- Деплой: `main` ветка → автодеплой на Timeweb App Platform
- Фронт в проде встроен в api: Vite билдит в `apps/web/dist`, Fastify раздаёт статику
- `index.html` отдаётся без кэша (`Cache-Control: no-cache`), остальное — с кэшем

### Переменные окружения (Timeweb dashboard)
```
KIE_API_KEY       # Bearer-токен для KIE API — обязателен
PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD / PGSSLMODE
PORT              # default 3000
HTTPS_PROXY       # опционально, для обхода гео-блокировки
```

---

## База данных

### Схема — только `apps/api/src/lib/db.ts`

Все изменения схемы — через функции `ensure*Table()` в этом файле. Они вызываются при старте сервера.

### Таблицы

| Таблица | Назначение |
|---|---|
| `chats` | Чаты (module, model, title, project_id) |
| `chat_messages` | Сообщения чатов (role: user/assistant, content) |
| `projects` | Проекты для группировки чатов (system_prompt, memory, context_files) |
| `engine_settings` | Глобальные настройки движков claude/chatgpt/gemini (about, instructions, memory) |
| `files` | Сгенерированные изображения и видео (task_id, url, prompt) |
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

## KIE API — критически важно не менять

Весь AI-функционал идёт через **KIE API** (`https://api.kie.ai`). Авторизация: `Authorization: Bearer ${KIE_API_KEY}`.

### Модуль claude — Anthropic Messages API

**Эндпоинт:** `POST https://api.kie.ai/claude/v1/messages`

```json
// Запрос (стандартный Anthropic формат)
{ "model": "claude-sonnet-4-5", "messages": [...], "system": "...", "stream": false }

// Ответ
{ "content": [{ "type": "text", "text": "..." }] }
```

**❌ НЕ МЕНЯТЬ** на OpenAI-совместимый формат (`/v1/chat/completions`, `role: "system"` в messages и т.д.) — это сломает все чаты.

Логика вызова: `apps/api/src/routes/chat.ts`

Ошибки KIE: могут приходить как HTTP 200 с `{ code: number, msg: string }` — всегда проверяй `data.code`.

### Остальные модули (image, video, prompt improvement)

- Генерация: `POST https://api.kie.ai/api/v1/jobs/createTask`
- Статус: `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=X`
- Улучшение промптов: `POST https://api.kie.ai/gpt-5-2/v1/chat/completions` (OpenAI-формат — только для этого эндпоинта)
- Баланс: `GET https://api.kie.ai/api/v1/chat/credit`

---

## Роуты и страницы

```
/dashboard    → DashboardPage
/claude       → ClaudePage → ChatModule (engine="claude")
/chatgpt      → ChatGPTPage → ChatModule (engine="chatgpt")
/gemini       → GeminiPage → ChatModule (engine="gemini")
/image        → ImagePage
/video        → VideoPage
/files        → FilesPage
/settings     → SettingsPage
```

Все три чат-движка используют один компонент `ChatModule` — не дублировать логику.

---

## Структура фронтенда

```
apps/web/src/
├── App.tsx                     # Роуты
├── main.tsx                    # QueryClient + RouterProvider
├── layout/                     # AppLayout, TopNav
├── modules/chat/               # ChatModule и все его части
│   ├── ChatModule.tsx          # Контейнер (3 панели)
│   ├── ChatView.tsx            # Центр: сообщения + ввод
│   ├── ChatMessage.tsx         # Рендер сообщения
│   ├── MessageInput.tsx        # Поле ввода
│   ├── ProjectsPanel.tsx       # Левая панель
│   └── PromptsPanel.tsx        # Правая панель (история чатов)
├── pages/                      # Страницы по роутам
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
| GET | `/api/chat/list?module=X` | Список чатов |
| GET | `/api/chat/:id/messages` | История сообщений |
| PATCH | `/api/chat/:id` | Обновить model/title/project_id |
| DELETE | `/api/chat/:id` | Удалить чат (cascade messages) |
| POST | `/api/chat/:id/send` | Отправить сообщение → KIE |
| PATCH | `/api/chat/:id/messages/:msgId` | Редактировать сообщение |
| DELETE | `/api/chat/:id/messages/:msgId` | Удалить сообщение |
| POST | `/api/chat/:id/messages/:msgId/regenerate` | Регенерировать ответ |

### Projects
`GET/POST /api/projects`, `PUT/DELETE /api/projects/:id`

### Images & Videos
`POST /api/image/generate`, `GET /api/image/status`, `GET /api/image/download`
`POST /api/video/generate`, `GET /api/video/status`, `GET /api/video/download`

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
- Параметры запроса всегда приводить через `as { ... }` с `.trim()`

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
