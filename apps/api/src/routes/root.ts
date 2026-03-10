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
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              font-family: Arial, sans-serif;
              background: #0b1220;
              color: #ffffff;
            }

            .app {
              display: grid;
              grid-template-columns: 260px 1fr;
              min-height: 100vh;
            }

            .sidebar {
              background: #0f172a;
              border-right: 1px solid rgba(255,255,255,0.08);
              padding: 24px 18px;
            }

            .logo {
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 8px;
            }

            .logo-sub {
              color: #94a3b8;
              font-size: 14px;
              margin-bottom: 28px;
            }

            .menu-group {
              margin-bottom: 24px;
            }

            .menu-title {
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: #64748b;
              margin-bottom: 12px;
            }

            .menu {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }

            .menu a {
              text-decoration: none;
              color: #e2e8f0;
              padding: 12px 14px;
              border-radius: 12px;
              background: transparent;
              transition: 0.2s ease;
              display: block;
            }

            .menu a:hover {
              background: rgba(255,255,255,0.06);
            }

            .menu a.active {
              background: #1d4ed8;
              color: white;
            }

            .content {
              padding: 28px;
            }

            .topbar {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 24px;
            }

            .topbar h1 {
              margin: 0;
              font-size: 32px;
            }

            .topbar p {
              margin: 6px 0 0;
              color: #94a3b8;
            }

            .status {
              padding: 10px 14px;
              border-radius: 999px;
              background: rgba(34,197,94,0.15);
              color: #86efac;
              font-size: 14px;
            }

            .grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 20px;
            }

            .card {
              background: #111827;
              border: 1px solid rgba(255,255,255,0.08);
              border-radius: 20px;
              padding: 22px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.18);
            }

            .card h2 {
              margin: 0 0 12px;
              font-size: 22px;
            }

            .card p {
              margin: 0 0 12px;
              color: #cbd5e1;
              line-height: 1.55;
            }

            .module-list {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 12px;
              margin-top: 14px;
            }

            .module-item {
              background: #0f172a;
              border: 1px solid rgba(255,255,255,0.08);
              border-radius: 14px;
              padding: 14px;
            }

            .module-item strong {
              display: block;
              margin-bottom: 6px;
            }

            .module-item span {
              color: #94a3b8;
              font-size: 14px;
              line-height: 1.4;
            }

            .footer-note {
              margin-top: 20px;
              color: #94a3b8;
              font-size: 14px;
            }

            @media (max-width: 900px) {
              .app {
                grid-template-columns: 1fr;
              }

              .sidebar {
                border-right: 0;
                border-bottom: 1px solid rgba(255,255,255,0.08);
              }

              .grid,
              .module-list {
                grid-template-columns: 1fr;
              }

              .topbar {
                flex-direction: column;
                align-items: flex-start;
                gap: 12px;
              }
            }
          </style>
        </head>
        <body>
          <div class="app">
            <aside class="sidebar">
              <div class="logo">KIE AI Studio</div>
              <div class="logo-sub">Единый web-интерфейс для AI-модулей</div>

              <div class="menu-group">
                <div class="menu-title">Основное</div>
                <nav class="menu">
                  <a href="/" class="active">Dashboard</a>
                </nav>
              </div>

              <div class="menu-group">
                <div class="menu-title">AI Chat</div>
                <nav class="menu">
                  <a href="#">Claude</a>
                  <a href="#">ChatGPT</a>
                  <a href="#">Gemini</a>
                </nav>
              </div>

              <div class="menu-group">
                <div class="menu-title">Media</div>
                <nav class="menu">
                  <a href="#">Image</a>
                  <a href="#">Video</a>
                  <a href="#">Audio</a>
                  <a href="#">Avatar</a>
                </nav>
              </div>

              <div class="menu-group">
                <div class="menu-title">Система</div>
                <nav class="menu">
                  <a href="#">Files</a>
                  <a href="#">Settings</a>
                </nav>
              </div>
            </aside>

            <main class="content">
              <div class="topbar">
                <div>
                  <h1>Dashboard</h1>
                  <p>Стартовый каркас интерфейса для будущих модулей системы.</p>
                </div>
                <div class="status">Backend online</div>
              </div>

              <div class="grid">
                <section class="card">
                  <h2>Текущий статус</h2>
                  <p>
                    Backend уже развернут на Timeweb и доступен по рабочему домену.
                    Базовая проверка состояния доступна по адресу <strong>/health</strong>.
                  </p>
                  <p>
                    Следующий этап — поочередно превращать каждый пункт меню в отдельный
                    модуль с собственным функционалом.
                  </p>
                  <div class="footer-note">
                    Сейчас это первая визуальная оболочка проекта.
                  </div>
                </section>

                <section class="card">
                  <h2>План модулей</h2>
                  <div class="module-list">
                    <div class="module-item">
                      <strong>Claude</strong>
                      <span>Отдельная чат-среда с проектами, контекстом, историей и памятью.</span>
                    </div>
                    <div class="module-item">
                      <strong>ChatGPT</strong>
                      <span>Независимый chat-блок с собственной логикой и настройками.</span>
                    </div>
                    <div class="module-item">
                      <strong>Gemini</strong>
                      <span>Третий изолированный чат-модуль внутри системы.</span>
                    </div>
                    <div class="module-item">
                      <strong>Image</strong>
                      <span>Генерация и редактирование изображений через KIE API.</span>
                    </div>
                    <div class="module-item">
                      <strong>Video</strong>
                      <span>Text-to-video и image-to-video в отдельной вкладке.</span>
                    </div>
                    <div class="module-item">
                      <strong>Audio</strong>
                      <span>Музыка, аудио и озвучка в отдельном модуле.</span>
                    </div>
                    <div class="module-item">
                      <strong>Avatar</strong>
                      <span>Генерация avatar-видео на основе изображения и аудио.</span>
                    </div>
                    <div class="module-item">
                      <strong>Files</strong>
                      <span>Единая галерея файлов и результатов для обмена между модулями.</span>
                    </div>
                  </div>
                </section>
              </div>
            </main>
          </div>
        </body>
      </html>
    `);
  });
}
