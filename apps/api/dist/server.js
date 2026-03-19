import { buildApp } from "./app.js";
import { ensureFilesTable, ensureChatsTable, ensureProjectsTable, ensureImageTemplatesTable, ensureVideoTemplatesTable, ensureEngineSettingsTable } from "./lib/db.js";
import { ProxyAgent, setGlobalDispatcher } from "undici";
// Если задан HTTPS_PROXY — все fetch запросы идут через него (нужно для обхода геоблокировки Anthropic)
if (process.env.HTTPS_PROXY) {
    setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));
}
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
async function start() {
    const app = buildApp();
    try {
        await ensureChatsTable();
        await ensureProjectsTable();
        await ensureFilesTable();
        await ensureImageTemplatesTable();
        await ensureVideoTemplatesTable();
        await ensureEngineSettingsTable();
        if (process.env.HTTPS_PROXY) {
            app.log.info({ proxy: process.env.HTTPS_PROXY }, "Using HTTPS_PROXY");
        }
        await app.listen({ port: PORT, host: HOST });
        app.log.info({ port: PORT, host: HOST, env: process.env.NODE_ENV ?? "development" }, "Server started");
    }
    catch (error) {
        app.log.error(error);
        process.exit(1);
    }
}
start();
