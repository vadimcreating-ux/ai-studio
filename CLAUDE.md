# Инструкции для Claude Code

## Архитектура

- `apps/api` — backend на Fastify (Node.js + TypeScript)
- `apps/web` — frontend
- БД: PostgreSQL (отдельный сервис на Timeweb, не в контейнере)
- Деплой: Timeweb App Platform (ветка `main`)

## Правила работы с базой данных

### Схема БД — `apps/api/src/lib/db.ts`

Все изменения схемы БД делаются через функции `ensure*Table()` в этом файле.

**Правила при изменении схемы:**

1. **Новая таблица** — используй `CREATE TABLE IF NOT EXISTS`
2. **Новая колонка** — используй `ALTER TABLE ... ADD COLUMN` с `.catch(() => {})`, так как колонка может уже существовать на проде
3. **Никогда не удаляй и не переименовывай** существующие колонки — это сломает прод с реальными данными
4. **Никогда не используй** `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` без явного подтверждения пользователя
5. Изменение типа колонки требует явного подтверждения — это деструктивная операция

**Пример добавления колонки:**
```typescript
await dbQuery(`
  ALTER TABLE some_table ADD COLUMN new_field TEXT DEFAULT ''
`).catch(() => {
  // колонка уже существует — это нормально
});
```

### Почему это важно

При деплое нового кода на Timeweb функции `ensure*Table()` выполняются при старте приложения. Данные пользователей хранятся в отдельной БД и **не удаляются** при деплое — но деструктивные миграции могут их повредить.

## Деплой

- `main` ветка автоматически деплоится на Timeweb
- Перед мержем в `main` убедись, что все изменения схемы БД следуют правилам выше
- Переменные окружения: `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSLMODE`

## KIE API — важно не менять

Для модуля `claude` используется **KIE API** (`https://api.kie.ai`) с форматом **Anthropic Messages API**:

- Эндпоинт: `POST https://api.kie.ai/claude/v1/messages`
- Формат запроса: стандартный Anthropic (`model`, `messages`, `system`, `stream`)
- Авторизация: `Authorization: Bearer ${KIE_API_KEY}`
- Ответ: стандартный Anthropic (`content: [{ type: "text", text: "..." }]`)

**Не менять на OpenAI-совместимый формат** (`/v1/chat/completions`, `messages[].role = "system"` и т.д.) — это сломает все чаты модуля claude.

Файл с логикой вызова: `apps/api/src/routes/chat.ts`
