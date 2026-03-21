import { buildApp } from "./app.js";
import {
  ensureUsersTable,
  ensureChatsTable,
  ensureProjectsTable,
  ensureFilesTable,
  ensureImageTemplatesTable,
  ensureVideoTemplatesTable,
  ensureEngineSettingsTable,
  ensureCreditTransactionsTable,
  ensureCreditPricesTable,
} from "./lib/db.js";
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  const app = buildApp();

  try {
    // users must be created first — other tables FK reference it
    await ensureUsersTable();
    await ensureChatsTable();
    await ensureProjectsTable();
    await ensureFilesTable();
    await ensureImageTemplatesTable();
    await ensureVideoTemplatesTable();
    await ensureEngineSettingsTable();
    await ensureCreditTransactionsTable();
    await ensureCreditPricesTable();

    await app.listen({ port: PORT, host: HOST });

    app.log.info({ port: PORT, host: HOST, env: process.env.NODE_ENV ?? "development" }, "Server started");
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
