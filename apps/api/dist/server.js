import { buildApp } from "./app.js";
import { ensureFilesTable, ensureChatsTable } from "./lib/db.js";
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
async function start() {
    const app = buildApp();
    try {
        await ensureFilesTable();
        await ensureChatsTable();
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
