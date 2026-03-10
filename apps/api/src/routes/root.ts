import type { FastifyInstance } from "fastify";

function renderPage(page: string) {
  const currentPage = page || "dashboard";

  const titles: Record<string, string> = {
  dashboard: "Dashboard",
  claude: "Claude",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
  image: "Image",
  video: "Video",
  audio: "Audio",
  avatar: "Avatar",
  files: "Files",
  settings: "Settings"
};

  const descriptions: Record<string, string> = {
  dashboard: "Стартовый каркас интерфейса для будущих модулей системы.",
  claude: "Независимый чат-модуль Claude с проектами, контекстом, историей и памятью.",
  chatgpt: "Независимый чат-модуль ChatGPT с собственной рабочей средой.",
  gemini: "Независимый чат-модуль Gemini с отдельной логикой и настройками.",
  image: "Модуль генерации и редактирования изображений через KIE API.",
  video: "Модуль генерации видео и image-to-video сценариев.",
  audio: "Модуль музыки, аудио и озвучки.",
  avatar: "Модуль генерации avatar-видео на основе изображения и аудио.",
  files: "Общая библиотека файлов и результатов всех модулей.",
  settings: "Общие настройки системы и будущих интеграций."
};

  const content: Record<string, string> = {
    dashboard: `
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
    `,
           claude: `
      <div class="workspace">
        <aside class="panel">
          <div class="panel-header-row">
            <h2>Проекты</h2>
            <button class="mini-btn" type="button">Новый</button>
          </div>
          <p class="panel-text">Отдельные проекты Claude с собственной историей и памятью.</p>

          <div class="project-list">
            <div class="project-item active-project">
              <strong>Бочкари</strong>
              <span>PR, бренд, тексты, обновление 2026</span>
            </div>
            <div class="project-item">
              <strong>Алтай / Гайды</strong>
              <span>Маршруты, mini guide, master guide</span>
            </div>
            <div class="project-item">
              <strong>Личный проект</strong>
              <span>Тестовая рабочая среда Claude</span>
            </div>
          </div>

          <div class="subsection">
            <div class="panel-header-row">
              <h3>Диалоги</h3>
              <button class="mini-btn" type="button">Чат</button>
            </div>

            <div class="dialog-list">
              <div class="dialog-item active-dialog">
                <strong>Новый бренд-пост</strong>
                <span>Последнее сообщение: 5 минут назад</span>
              </div>
              <div class="dialog-item">
                <strong>Текст для сайта</strong>
                <span>Последнее сообщение: вчера</span>
              </div>
              <div class="dialog-item">
                <strong>Описание лимонадов</strong>
                <span>Последнее сообщение: 2 дня назад</span>
              </div>
            </div>
          </div>

          <div class="footer-note">
            Позже здесь появятся поиск, фильтрация и архив диалогов.
          </div>
        </aside>

        <section class="panel chat-panel">
          <div class="project-topbar">
            <div>
              <div class="project-top-label">Текущий проект</div>
              <div class="project-top-title">Бочкари</div>
            </div>
            <div class="top-actions">
              <button class="ghost-btn" type="button">Настройки проекта</button>
              <button class="ghost-btn" type="button">Сохранить память</button>
            </div>
          </div>

          <h2>Чат Claude</h2>
          <p class="panel-text">Независимая среда общения внутри выбранного проекта.</p>

          <div class="chat-box">
            <div class="message assistant">
              <div class="message-role">Claude</div>
              <div class="message-text">
                Добро пожаловать в модуль Claude. Здесь будет история диалогов,
                работа по проектам и отдельная память только для Claude.
              </div>
            </div>

            <div class="message user">
              <div class="message-role">Вы</div>
              <div class="message-text">
                Покажи мне структуру будущего рабочего модуля.
              </div>
            </div>

            <div class="message assistant">
              <div class="message-role">Claude</div>
              <div class="message-text">
                В этом модуле будут проекты, список диалогов, центральное окно чата,
                а справа — контекст проекта, память и настройки.
              </div>
            </div>

            <div class="message user">
              <div class="message-role">Вы</div>
              <div class="message-text">
                Добавь акцент на то, что данные Claude не должны смешиваться с ChatGPT и Gemini.
              </div>
            </div>

            <div class="message assistant">
              <div class="message-role">Claude</div>
              <div class="message-text">
                Принято. Claude будет работать как отдельная среда: свои проекты,
                свой контекст, своя история, своя память и собственные настройки.
              </div>
            </div>
          </div>

          <div class="composer">
            <input type="text" placeholder="Поле ввода сообщения появится здесь" />
            <button type="button">Отправить</button>
          </div>
        </section>

        <aside class="panel">
          <div class="panel-header-row">
            <h2>Контекст и память</h2>
            <button class="mini-btn" type="button">Изменить</button>
          </div>
          <p class="panel-text">Правая панель с настройками выбранного проекта Claude.</p>

          <div class="right-section">
            <h3>Контекст проекта</h3>
            <div class="info-card">
              <strong>Роль модели</strong>
              <span>PR-редактор и стратег проекта.</span>
            </div>
            <div class="info-card">
              <strong>Стиль</strong>
              <span>Живой, уверенный, без лишнего пафоса.</span>
            </div>
          </div>

          <div class="right-section">
            <h3>Память проекта</h3>
            <div class="info-card">
              <strong>Закрепленные правила</strong>
              <span>Не смешивать данные Claude с другими чат-модулями.</span>
            </div>
            <div class="info-card">
              <strong>Важные факты</strong>
              <span>Ключевые формулировки, бренд-контекст, рабочие договоренности.</span>
            </div>
          </div>

          <div class="right-section">
            <h3>История</h3>
            <div class="info-card">
              <strong>Быстрый доступ</strong>
              <span>Позже сюда можно вынести последние чаты, поиск и закрепленные диалоги.</span>
            </div>
          </div>

          <div class="footer-note">
            Это отдельная среда Claude, не связанная с ChatGPT и Gemini.
          </div>
        </aside>
      </div>
    `,
    chatgpt: `
      <div class="grid">
        <section class="card">
          <h2>Структура модуля ChatGPT</h2>
          <p>Этот блок будет жить отдельно от Claude и Gemini.</p>
          <div class="module-list">
            <div class="module-item">
              <strong>Проекты</strong>
              <span>Свои проекты и сценарии работы только для ChatGPT.</span>
            </div>
            <div class="module-item">
              <strong>Контекст</strong>
              <span>Системные инструкции и настройки ответов.</span>
            </div>
            <div class="module-item">
              <strong>История</strong>
              <span>Собственная история переписки по проектам.</span>
            </div>
            <div class="module-item">
              <strong>Память</strong>
              <span>Память проекта и закрепленные рабочие правила.</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>Назначение</h2>
          <p>
            Здесь будет отдельная среда для работы с задачами через ChatGPT:
            тексты, идеи, системные инструкции, проектная переписка и сохраненная память.
          </p>
          <div class="footer-note">
            В этом модуле данные не должны смешиваться с Claude и Gemini.
          </div>
        </section>
      </div>
    `,
    gemini: `
      <div class="grid">
        <section class="card">
          <h2>Структура модуля Gemini</h2>
          <p>Gemini будет третьим независимым chat-блоком внутри системы.</p>
          <div class="module-list">
            <div class="module-item">
              <strong>Проекты</strong>
              <span>Отдельный список проектов для работы через Gemini.</span>
            </div>
            <div class="module-item">
              <strong>Контекст</strong>
              <span>Свои инструкции, роль, ограничения и стиль.</span>
            </div>
            <div class="module-item">
              <strong>История</strong>
              <span>Отдельные чаты и история сообщений.</span>
            </div>
            <div class="module-item">
              <strong>Память</strong>
              <span>Память и правила, привязанные только к Gemini.</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>Следующий шаг по модулю</h2>
          <p>
            После базовой навигации сюда можно будет добавить собственную
            структуру проекта и экран чата в том же графитовом стиле.
          </p>
          <div class="footer-note">
            Gemini — отдельная рабочая среда, а не переключатель внутри общего чата.
          </div>
        </section>
      </div>
    `,
        image: `
      <div class="grid">
        <section class="card">
          <h2>Структура модуля Image</h2>
          <p>Этот модуль будет отвечать за генерацию и редактирование изображений.</p>
          <div class="module-list">
            <div class="module-item">
              <strong>Text-to-Image</strong>
              <span>Создание изображений по текстовому описанию.</span>
            </div>
            <div class="module-item">
              <strong>Image Edit</strong>
              <span>Редактирование уже загруженных изображений.</span>
            </div>
            <div class="module-item">
              <strong>История</strong>
              <span>Список всех прошлых генераций и правок.</span>
            </div>
            <div class="module-item">
              <strong>Сохранение</strong>
              <span>Передача результата в Files для дальнейшего использования.</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>Следующий этап</h2>
          <p>Сюда позже добавятся форма генерации, загрузка исходников, выбор модели и галерея результатов.</p>
          <div class="footer-note">Image станет отдельной рабочей зоной для визуального контента.</div>
        </section>
      </div>
    `,
    video: `
      <div class="grid">
        <section class="card">
          <h2>Структура модуля Video</h2>
          <p>Этот модуль будет отвечать за video generation и image-to-video задачи.</p>
          <div class="module-list">
            <div class="module-item">
              <strong>Text-to-Video</strong>
              <span>Генерация видео по текстовому сценарию.</span>
            </div>
            <div class="module-item">
              <strong>Image-to-Video</strong>
              <span>Создание видео на основе изображения.</span>
            </div>
            <div class="module-item">
              <strong>Статусы задач</strong>
              <span>Отслеживание выполнения генерации.</span>
            </div>
            <div class="module-item">
              <strong>Результаты</strong>
              <span>Сохранение финальных роликов в Files.</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>Следующий этап</h2>
          <p>Позже здесь появятся форма запуска, выбор source image, параметры видео и просмотр результата.</p>
          <div class="footer-note">Video будет отдельной рабочей вкладкой для всех видео-сценариев.</div>
        </section>
      </div>
    `,
    audio: `
      <div class="grid">
        <section class="card">
          <h2>Структура модуля Audio</h2>
          <p>Этот модуль будет отвечать за музыку, аудио и озвучку.</p>
          <div class="module-list">
            <div class="module-item">
              <strong>Music</strong>
              <span>Генерация музыкальных треков.</span>
            </div>
            <div class="module-item">
              <strong>Voice / TTS</strong>
              <span>Озвучка текста и аудио-сценарии.</span>
            </div>
            <div class="module-item">
              <strong>История</strong>
              <span>Список аудио-результатов по всем запускам.</span>
            </div>
            <div class="module-item">
              <strong>Передача дальше</strong>
              <span>Использование аудио в Avatar и Files.</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>Следующий этап</h2>
          <p>Позже здесь появятся формы для music generation, озвучки и библиотека аудиофайлов.</p>
          <div class="footer-note">Audio станет отдельным центром работы со звуком.</div>
        </section>
      </div>
    `,
    avatar: `
      <div class="grid">
        <section class="card">
          <h2>Структура модуля Avatar</h2>
          <p>Этот модуль будет отвечать за avatar-видео и talking avatar сценарии.</p>
          <div class="module-list">
            <div class="module-item">
              <strong>Source Image</strong>
              <span>Выбор лица или изображения для аватара.</span>
            </div>
            <div class="module-item">
              <strong>Audio Source</strong>
              <span>Подключение аудио для lipsync и речи.</span>
            </div>
            <div class="module-item">
              <strong>История</strong>
              <span>Список созданных avatar-видео.</span>
            </div>
            <div class="module-item">
              <strong>Сохранение</strong>
              <span>Передача результата в общую файловую библиотеку.</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>Следующий этап</h2>
          <p>Позже здесь появятся форма выбора изображения, аудио и настройки генерации аватара.</p>
          <div class="footer-note">Avatar станет отдельной рабочей средой для персонажей и роликов.</div>
        </section>
      </div>
    `,
    files: `
      <div class="grid">
        <section class="card">
          <h2>Структура модуля Files</h2>
          <p>Files будет общей библиотекой файлов и результатов для всех модулей.</p>
          <div class="module-list">
            <div class="module-item">
              <strong>Изображения</strong>
              <span>Результаты из Image и загруженные исходники.</span>
            </div>
            <div class="module-item">
              <strong>Видео</strong>
              <span>Ролики из Video и Avatar.</span>
            </div>
            <div class="module-item">
              <strong>Аудио</strong>
              <span>Треки и озвучка из Audio.</span>
            </div>
            <div class="module-item">
              <strong>Повторное использование</strong>
              <span>Передача файлов между всеми вкладками.</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>Назначение</h2>
          <p>Files станет общей точкой обмена данными между Image, Video, Audio и Avatar.</p>
          <div class="footer-note">Именно здесь будет находиться единая галерея результатов.</div>
        </section>
      </div>
    `,
    settings: `
      <div class="grid">
        <section class="card">
          <h2>Структура модуля Settings</h2>
          <p>Здесь будут находиться общие настройки приложения и интеграций.</p>
          <div class="module-list">
            <div class="module-item">
              <strong>API</strong>
              <span>Параметры подключения и будущие ключи интеграций.</span>
            </div>
            <div class="module-item">
              <strong>UI</strong>
              <span>Тема, визуальные настройки и базовые параметры интерфейса.</span>
            </div>
            <div class="module-item">
              <strong>Поведение</strong>
              <span>Базовые настройки модулей и системы.</span>
            </div>
            <div class="module-item">
              <strong>Служебные параметры</strong>
              <span>Диагностика и системная конфигурация.</span>
            </div>
          </div>
        </section>

        <section class="card">
          <h2>Следующий этап</h2>
          <p>Позже здесь появятся реальные настройки приложения, интеграций и параметров модулей.</p>
          <div class="footer-note">Settings будет общим системным разделом проекта.</div>
        </section>
      </div>
    `
  };

  const title = titles[currentPage] || "Dashboard";
  const description = descriptions[currentPage] || descriptions.dashboard;
  const pageContent = content[currentPage] || content.dashboard;

  const isActive = (value: string) => currentPage === value ? "active" : "";

  return `
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${title} — KIE AI Studio</title>
        <style>
          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            font-family: Arial, sans-serif;
            background: #111315;
            color: #f3f4f6;
          }

          .app {
            display: grid;
            grid-template-columns: 260px 1fr;
            min-height: 100vh;
          }

          .sidebar {
            background: #171a1d;
            border-right: 1px solid rgba(255,255,255,0.06);
            padding: 24px 18px;
          }

          .logo {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
          }

          .logo-sub {
            color: #9ca3af;
            font-size: 14px;
            margin-bottom: 28px;
            line-height: 1.4;
          }

          .menu-group {
            margin-bottom: 24px;
          }

          .menu-title {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b7280;
            margin-bottom: 12px;
          }

          .menu {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .menu a {
            text-decoration: none;
            color: #d1d5db;
            padding: 12px 14px;
            border-radius: 12px;
            background: transparent;
            transition: 0.2s ease;
            display: block;
          }

          .menu a:hover {
            background: rgba(255,255,255,0.05);
          }

          .menu a.active {
            background: #2b57d9;
            color: #ffffff;
          }

          .content {
            padding: 28px;
            background: #121417;
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
            color: #9ca3af;
          }

          .status {
            padding: 10px 14px;
            border-radius: 999px;
            background: rgba(34,197,94,0.12);
            color: #86efac;
            font-size: 14px;
          }

          .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 20px;
          }
          .workspace {
            display: grid;
            grid-template-columns: 280px 1fr 320px;
            gap: 20px;
          }

          .panel {
            background: #1a1d21;
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 20px;
            padding: 22px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.18);
          }

          .panel h2 {
            margin: 0 0 10px;
            font-size: 22px;
          }
          .panel h3 {
            margin: 0 0 10px;
            font-size: 16px;
            color: #d1d5db;
          }

          .panel-header-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 10px;
          }

          .subsection {
            margin-top: 18px;
          }

          .dialog-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .dialog-item {
            background: #20242a;
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 14px;
            padding: 12px;
          }

          .dialog-item strong {
            display: block;
            margin-bottom: 6px;
          }

          .dialog-item span {
            color: #9ca3af;
            font-size: 13px;
            line-height: 1.4;
          }

          .active-dialog {
            outline: 1px solid #2b57d9;
          }

          .mini-btn {
            border: 1px solid rgba(255,255,255,0.08);
            background: #20242a;
            color: #e5e7eb;
            border-radius: 10px;
            padding: 8px 12px;
            font-size: 13px;
            cursor: pointer;
          }

          .project-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 18px;
            padding-bottom: 16px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
          }

          .project-top-label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #6b7280;
            margin-bottom: 6px;
          }

          .project-top-title {
            font-size: 24px;
            font-weight: 700;
          }

          .top-actions {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
          }

          .ghost-btn {
            border: 1px solid rgba(255,255,255,0.08);
            background: transparent;
            color: #d1d5db;
            border-radius: 12px;
            padding: 10px 14px;
            cursor: pointer;
          }

          .right-section {
            margin-bottom: 18px;
          }
          .panel-text {
            margin: 0 0 16px;
            color: #9ca3af;
            line-height: 1.5;
          }

          .project-list {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .project-item {
            background: #20242a;
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 14px;
            padding: 14px;
          }

          .project-item strong {
            display: block;
            margin-bottom: 6px;
          }

          .project-item span {
            color: #9ca3af;
            font-size: 14px;
            line-height: 1.4;
          }

          .active-project {
            outline: 2px solid #2b57d9;
          }

          .chat-panel {
            display: flex;
            flex-direction: column;
          }

          .chat-box {
            display: flex;
            flex-direction: column;
            gap: 14px;
            min-height: 420px;
            background: #15181c;
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 16px;
            padding: 16px;
            margin-bottom: 16px;
          }

          .message {
            max-width: 85%;
            border-radius: 16px;
            padding: 14px;
          }

          .message-role {
            font-size: 12px;
            color: #9ca3af;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .message-text {
            line-height: 1.55;
            color: #e5e7eb;
          }

          .message.assistant {
            background: #20242a;
            align-self: flex-start;
          }

          .message.user {
            background: #1e3a8a;
            align-self: flex-end;
          }

          .composer {
            display: grid;
            grid-template-columns: 1fr 140px;
            gap: 12px;
          }

          .composer input {
            width: 100%;
            border: 1px solid rgba(255,255,255,0.08);
            background: #20242a;
            color: #f3f4f6;
            border-radius: 14px;
            padding: 14px 16px;
            outline: none;
          }

          .composer button {
            border: 0;
            border-radius: 14px;
            background: #2b57d9;
            color: white;
            font-weight: 600;
            cursor: pointer;
          }

          .info-card {
            background: #20242a;
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 14px;
            padding: 14px;
            margin-bottom: 12px;
          }

          .info-card strong {
            display: block;
            margin-bottom: 6px;
          }

          .info-card span {
            color: #9ca3af;
            font-size: 14px;
            line-height: 1.45;
          }
          .card {
            background: #1a1d21;
            border: 1px solid rgba(255,255,255,0.06);
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
            background: #20242a;
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 14px;
            padding: 14px;
          }

          .module-item strong {
            display: block;
            margin-bottom: 6px;
          }

          .module-item span {
            color: #9ca3af;
            font-size: 14px;
            line-height: 1.4;
          }

          .footer-note {
            margin-top: 20px;
            color: #9ca3af;
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
            .workspace {
              grid-template-columns: 1fr;
            }

            .composer {
              grid-template-columns: 1fr;
            }
                        .project-topbar {
              flex-direction: column;
              align-items: flex-start;
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
                <a href="/?page=dashboard" class="${isActive("dashboard")}">Dashboard</a>
              </nav>
            </div>

            <div class="menu-group">
              <div class="menu-title">AI Chat</div>
              <nav class="menu">
                <a href="/?page=claude" class="${isActive("claude")}">Claude</a>
                <a href="/?page=chatgpt" class="${isActive("chatgpt")}">ChatGPT</a>
                <a href="/?page=gemini" class="${isActive("gemini")}">Gemini</a>
              </nav>
            </div>

                        <div class="menu-group">
              <div class="menu-title">Media</div>
              <nav class="menu">
                <a href="/?page=image" class="${isActive("image")}">Image</a>
                <a href="/?page=video" class="${isActive("video")}">Video</a>
                <a href="/?page=audio" class="${isActive("audio")}">Audio</a>
                <a href="/?page=avatar" class="${isActive("avatar")}">Avatar</a>
              </nav>
            </div>

                        <div class="menu-group">
              <div class="menu-title">Система</div>
              <nav class="menu">
                <a href="/?page=files" class="${isActive("files")}">Files</a>
                <a href="/?page=settings" class="${isActive("settings")}">Settings</a>
              </nav>
            </div>
          </aside>

          <main class="content">
            <div class="topbar">
              <div>
                <h1>${title}</h1>
                <p>${description}</p>
              </div>
              <div class="status">Backend online</div>
            </div>

            ${pageContent}
          </main>
        </div>
      </body>
    </html>
  `;
}

export async function rootRoutes(app: FastifyInstance) {
  app.get("/", async (request, reply) => {
    const query = request.query as { page?: string };
    const page = query?.page || "dashboard";

    reply.type("text/html").send(renderPage(page));
  });
}
