# AI Studio

MVP-проект веб-интерфейса для работы с несколькими AI-модулями через KIE API.

## Структура

- `apps/api` — backend на Fastify
- `apps/web` — frontend
- корневой `package.json` нужен для деплоя на Timeweb

## База данных

PostgreSQL — отдельный сервис на Timeweb (не в контейнере). Схема управляется через функции `ensure*Table()` в `apps/api/src/lib/db.ts`.

**Правила изменения схемы:**
- Новые таблицы: `CREATE TABLE IF NOT EXISTS`
- Новые колонки: `ALTER TABLE ... ADD COLUMN` + `.catch(() => {})` (колонка может уже существовать)
- Нельзя удалять/переименовывать колонки без явного подтверждения
