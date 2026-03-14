import { buildApp } from "./app.js";
import { ensureFilesTable, ensureChatsTable, ensureProjectsTable, ensureImageTemplatesTable, ensureVideoTemplatesTable } from "./lib/db.js";
import { ProxyAgent, setGlobalDispatcher } from "undici";
// Если задан HTTPS_PROXY — все fetch запросы идут через него (нужно для обхода геоблокировки Anthropic)
if (process.env.HTTPS_PROXY) {
    setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY));
    console.log(`[proxy] Using HTTPS_PROXY: ${process.env.HTTPS_PROXY}`);
}
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
async function start() {
    const app = buildApp();
    try {
        await ensureProjectsTable();
        await ensureFilesTable();
        await ensureChatsTable();
        await ensureImageTemplatesTable();
        await ensureVideoTemplatesTable();
        await app.listen({
            port: PORT,
            host: HOST
        });
        app.log.info(`Server started on http://${HOST}:${PORT}`);
    }
    catch (error) {
        app.log.error(error);
        process.exit(1);
    }
}
start();
