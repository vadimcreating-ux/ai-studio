#!/usr/bin/env tsx
/**
 * Агент проверки правил кодинга (CLAUDE.md)
 * Запускается как pre-commit хук и через Claude Code hook
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const errors: string[] = [];
const warnings: string[] = [];

// Получаем список изменённых файлов в коммите
function getStagedFiles(): string[] {
  try {
    const out = execSync("git diff --cached --name-only --diff-filter=ACM", {
      cwd: ROOT,
      encoding: "utf-8",
    });
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

function readStagedFile(path: string): string {
  try {
    // Читаем staged версию файла (не рабочую копию)
    return execSync(`git show :${path}`, { cwd: ROOT, encoding: "utf-8" });
  } catch {
    return "";
  }
}

const staged = getStagedFiles();

// ─── 1. Прямой fetch в компонентах фронтенда ───────────────────────────────
const frontendFiles = staged.filter(
  (f) =>
    f.startsWith("apps/web/src/") &&
    (f.endsWith(".tsx") || f.endsWith(".ts")) &&
    !f.startsWith("apps/web/src/shared/api/") &&
    !f.endsWith(".test.ts") &&
    !f.endsWith(".spec.ts")
);

for (const file of frontendFiles) {
  const content = readStagedFile(file);
  // Ищем fetch( но не в комментариях и не fetchXxx (переменные)
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
    if (/\bfetch\s*\(/.test(line) && !/\/\/.*fetch/.test(line)) {
      errors.push(
        `❌ Прямой fetch() в ${file}:${i + 1} — используй React Query + shared/api/`
      );
    }
  });
}

// ─── 2. console.log в backend ───────────────────────────────────────────────
const backendFiles = staged.filter(
  (f) =>
    f.startsWith("apps/api/src/") &&
    (f.endsWith(".ts") || f.endsWith(".tsx"))
);

for (const file of backendFiles) {
  const content = readStagedFile(file);
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
    if (/\bconsole\.(log|error|warn|info)\s*\(/.test(line)) {
      errors.push(
        `❌ console.log в ${file}:${i + 1} — используй app.log / request.log`
      );
    }
  });
}

// ─── 3. as { вместо Zod safeParse ──────────────────────────────────────────
for (const file of backendFiles) {
  const content = readStagedFile(file);
  const lines = content.split("\n");
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
    // Ищем ) as { или req.body as { — типичный cast вместо валидации
    if (/\)\s+as\s+\{/.test(line) || /body\s+as\s+\{/.test(line) || /params\s+as\s+\{/.test(line)) {
      errors.push(
        `❌ Type cast вместо Zod в ${file}:${i + 1} — используй schema.safeParse()`
      );
    }
  });
}

// ─── 4. Тяжёлые нативные зависимости ───────────────────────────────────────
const BANNED_NATIVE_DEPS = [
  "bcrypt",        // используй bcryptjs
  "sharp",         // тяжёлый нативный
  "canvas",        // требует Cairo
  "node-gyp",      // сам по себе не нужен в deps
  "playwright",    // только в GitHub Actions CI
  "@playwright/test", // только в GitHub Actions CI
];

const packageJsonFiles = staged.filter((f) => f.endsWith("package.json") && !f.includes("node_modules"));

for (const file of packageJsonFiles) {
  const content = readStagedFile(file);
  try {
    const pkg = JSON.parse(content);
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    for (const banned of BANNED_NATIVE_DEPS) {
      if (allDeps[banned]) {
        const isPlaywright = banned.includes("playwright");
        if (isPlaywright && file === "package.json") {
          // playwright в корне — особо опасно (попадает в Docker)
          errors.push(
            `❌ ${banned} в корневом ${file} — вызывает OOM при Docker-сборке. Playwright только в GitHub Actions CI`
          );
        } else if (!isPlaywright) {
          errors.push(
            `❌ ${banned} в ${file} — нативная зависимость, вешает деплой. Замени на ${banned === "bcrypt" ? "bcryptjs" : "аналог без node-gyp"}`
          );
        }
      }
    }
  } catch {
    // не JSON — пропускаем
  }
}

// ─── 5. Новый API эндпоинт без smoke-теста ─────────────────────────────────
const newRouteFiles = staged.filter(
  (f) => f.startsWith("apps/api/src/routes/") && f.endsWith(".ts")
);

if (newRouteFiles.length > 0) {
  const smokeFile = join(ROOT, "apps/tests/smoke.ts");
  const smokeStaged = staged.find((f) => f === "apps/tests/smoke.ts");

  if (!smokeStaged) {
    // Проверяем добавлены ли новые роуты (новые POST/GET регистрации)
    for (const file of newRouteFiles) {
      const content = readStagedFile(file);
      const diffOut = execSync(`git diff --cached -- "${file}"`, {
        cwd: ROOT,
        encoding: "utf-8",
      });
      const newRoutes = diffOut
        .split("\n")
        .filter((l) => l.startsWith("+") && /app\.(get|post|put|patch|delete)\s*\(/.test(l));

      if (newRoutes.length > 0) {
        warnings.push(
          `⚠️  Новые роуты в ${file} — добавь smoke-тест в apps/tests/smoke.ts`
        );
      }
    }
  }
}

// ─── 6. Изменения схемы БД без safeguard ───────────────────────────────────
const dbFiles = staged.filter((f) => f === "apps/api/src/lib/db.ts");

for (const file of dbFiles) {
  const diff = execSync(`git diff --cached -- "${file}"`, {
    cwd: ROOT,
    encoding: "utf-8",
  });
  const addedLines = diff.split("\n").filter((l) => l.startsWith("+"));

  // DROP TABLE/COLUMN без явного подтверждения
  const dangerous = addedLines.filter((l) =>
    /DROP\s+(TABLE|COLUMN)/i.test(l)
  );
  if (dangerous.length > 0) {
    errors.push(
      `❌ Деструктивная операция в db.ts (DROP TABLE/COLUMN) — требует явного подтверждения пользователя`
    );
  }

  // ALTER TABLE ADD COLUMN без .catch
  const alterLines = addedLines.filter((l) => /ALTER TABLE.*ADD COLUMN/i.test(l));
  if (alterLines.length > 0) {
    const hasCatch = diff.includes(".catch(");
    if (!hasCatch) {
      errors.push(
        `❌ ALTER TABLE ADD COLUMN в db.ts без .catch(() => {}) — колонка может уже существовать на проде`
      );
    }
  }
}

// ─── Вывод результата ───────────────────────────────────────────────────────
console.log("\n🔍 Проверка правил кодинга (CLAUDE.md)...\n");

if (warnings.length > 0) {
  warnings.forEach((w) => console.log(w));
  console.log();
}

if (errors.length > 0) {
  errors.forEach((e) => console.log(e));
  console.log(`\n🚫 Найдено ${errors.length} нарушений. Коммит отменён.\n`);
  process.exit(1);
} else {
  console.log("✅ Все проверки пройдены\n");
  process.exit(0);
}
