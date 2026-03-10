import type { FastifyInstance } from "fastify";

export async function rootRoutes(app: FastifyInstance) {
  app.get("/", async (_request, reply) => {
    reply.type("text/html").send(`
      <!doctype html>
      <html lang="ru">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>KIE AI Studio</title>
          <style>
            body {
              margin: 0;
              font-family: Arial, sans-serif;
              background: #0f172a;
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .box {
              max-width: 700px;
              padding: 32px;
              border-radius: 20px;
              background: #111827;
              box-shadow: 0 10px 30px rgba(0,0,0,0.3);
              text-align: center;
            }
            h1 {
              margin: 0 0 16px;
              font-size: 36px;
            }
            p {
              margin: 0 0 10px;
              line-height: 1.5;
              color: #d1d5db;
            }
            code {
              color: #93c5fd;
            }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>KIE AI Studio</h1>
            <p>Backend успешно запущен на Timeweb.</p>
            <p>Проверка состояния доступна по адресу <code>/health</code>.</p>
            <p>Следующий этап — подключение frontend и вкладок интерфейса.</p>
          </div>
        </body>
      </html>
    `);
  });
}
