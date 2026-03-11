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
      <div class="workspace">
        <aside class="panel">
          <div class="panel-header-row">
            <h2>Проекты</h2>
            <button class="mini-btn" type="button">Новый</button>
          </div>
          <p class="panel-text">Отдельные проекты ChatGPT с собственной историей и памятью.</p>

          <div class="project-list">
            <div class="project-item active-project">
              <strong>Контент-план</strong>
              <span>Посты, идеи, рубрики, сценарии</span>
            </div>
            <div class="project-item">
              <strong>Бочкари / сайт</strong>
              <span>Тексты, описания, новости</span>
            </div>
            <div class="project-item">
              <strong>Тестовый проект</strong>
              <span>Черновая рабочая среда ChatGPT</span>
            </div>
          </div>

          <div class="subsection">
            <div class="panel-header-row">
              <h3>Диалоги</h3>
              <button class="mini-btn" type="button">Чат</button>
            </div>

            <div class="dialog-list">
              <div class="dialog-item active-dialog">
                <strong>Идеи для карусели</strong>
                <span>Последнее сообщение: 3 минуты назад</span>
              </div>
              <div class="dialog-item">
                <strong>Пост для соцсетей</strong>
                <span>Последнее сообщение: сегодня</span>
              </div>
              <div class="dialog-item">
                <strong>Описание продукта</strong>
                <span>Последнее сообщение: вчера</span>
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
              <div class="project-top-title">Контент-план</div>
            </div>
            <div class="top-actions">
              <button class="ghost-btn" type="button">Настройки проекта</button>
              <button class="ghost-btn" type="button">Сохранить память</button>
            </div>
          </div>

          <h2>Чат ChatGPT</h2>
          <p class="panel-text">Независимая рабочая среда для задач через ChatGPT.</p>

          <div class="chat-box">
            <div class="message assistant">
              <div class="message-role">ChatGPT</div>
              <div class="message-text">
                Этот модуль предназначен для работы с идеями, текстами, сценариями и проектной перепиской.
              </div>
            </div>

            <div class="message user">
              <div class="message-role">Вы</div>
              <div class="message-text">
                Собери структуру рабочего пространства для контент-проекта.
              </div>
            </div>

            <div class="message assistant">
              <div class="message-role">ChatGPT</div>
              <div class="message-text">
                Здесь будут отдельные проекты, история чатов, центральная область сообщений,
                а справа — контекст, память и настройки по проекту.
              </div>
            </div>

            <div class="message user">
              <div class="message-role">Вы</div>
              <div class="message-text">
                Важно, чтобы данные ChatGPT не смешивались с Claude и Gemini.
              </div>
            </div>

            <div class="message assistant">
              <div class="message-role">ChatGPT</div>
              <div class="message-text">
                Да, этот блок будет полностью независим: свои проекты, своя история,
                своя память и свои рабочие настройки.
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
          <p class="panel-text">Правая панель с настройками выбранного проекта ChatGPT.</p>

          <div class="right-section">
            <h3>Контекст проекта</h3>
            <div class="info-card">
              <strong>Роль модели</strong>
              <span>Контент-стратег и редактор.</span>
            </div>
            <div class="info-card">
              <strong>Стиль</strong>
              <span>Понятный, живой, структурный, без перегруза.</span>
            </div>
          </div>

          <div class="right-section">
            <h3>Память проекта</h3>
            <div class="info-card">
              <strong>Закрепленные правила</strong>
              <span>Не смешивать данные ChatGPT с Claude и Gemini.</span>
            </div>
            <div class="info-card">
              <strong>Факты проекта</strong>
              <span>Темы, форматы контента, рабочие ограничения и утвержденные формулировки.</span>
            </div>
          </div>

          <div class="right-section">
            <h3>История</h3>
            <div class="info-card">
              <strong>Быстрый доступ</strong>
              <span>Позже сюда можно вынести последние чаты, закрепления и быстрый поиск.</span>
            </div>
          </div>

          <div class="footer-note">
            Это отдельная среда ChatGPT, не связанная с Claude и Gemini.
          </div>
        </aside>
      </div>
    `,
        gemini: `
      <div class="workspace">
        <aside class="panel">
          <div class="panel-header-row">
            <h2>Проекты</h2>
            <button class="mini-btn" type="button">Новый</button>
          </div>
          <p class="panel-text">Отдельные проекты Gemini с собственной историей и памятью.</p>

          <div class="project-list">
            <div class="project-item active-project">
              <strong>Аналитика</strong>
              <span>Разборы, структурирование, исследования</span>
            </div>
            <div class="project-item">
              <strong>Эксперименты</strong>
              <span>Тестовые сценарии работы с Gemini</span>
            </div>
            <div class="project-item">
              <strong>Черновики</strong>
              <span>Промежуточная рабочая среда</span>
            </div>
          </div>

          <div class="subsection">
            <div class="panel-header-row">
              <h3>Диалоги</h3>
              <button class="mini-btn" type="button">Чат</button>
            </div>

            <div class="dialog-list">
              <div class="dialog-item active-dialog">
                <strong>Разбор структуры</strong>
                <span>Последнее сообщение: 8 минут назад</span>
              </div>
              <div class="dialog-item">
                <strong>Анализ интерфейса</strong>
                <span>Последнее сообщение: сегодня</span>
              </div>
              <div class="dialog-item">
                <strong>Тест системных ролей</strong>
                <span>Последнее сообщение: вчера</span>
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
              <div class="project-top-title">Аналитика</div>
            </div>
            <div class="top-actions">
              <button class="ghost-btn" type="button">Настройки проекта</button>
              <button class="ghost-btn" type="button">Сохранить память</button>
            </div>
          </div>

          <h2>Чат Gemini</h2>
          <p class="panel-text">Независимая рабочая среда для задач через Gemini.</p>

          <div class="chat-box">
            <div class="message assistant">
              <div class="message-role">Gemini</div>
              <div class="message-text">
                Этот модуль предназначен для аналитики, структурирования и отдельных сценариев работы через Gemini.
              </div>
            </div>

            <div class="message user">
              <div class="message-role">Вы</div>
              <div class="message-text">
                Покажи, как будет устроен независимый модуль Gemini.
              </div>
            </div>

            <div class="message assistant">
              <div class="message-role">Gemini</div>
              <div class="message-text">
                Внутри модуля будут отдельные проекты, список диалогов, центральный чат,
                а справа — контекст проекта, память и служебные настройки.
              </div>
            </div>

            <div class="message user">
              <div class="message-role">Вы</div>
              <div class="message-text">
                Нужно, чтобы Gemini не пересекался по данным с Claude и ChatGPT.
              </div>
            </div>

            <div class="message assistant">
              <div class="message-role">Gemini</div>
              <div class="message-text">
                Да, это будет полностью изолированная рабочая среда:
                своя память, своя история, свои проекты и свои настройки.
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
          <p class="panel-text">Правая панель с настройками выбранного проекта Gemini.</p>

          <div class="right-section">
            <h3>Контекст проекта</h3>
            <div class="info-card">
              <strong>Роль модели</strong>
              <span>Аналитик и структурный помощник.</span>
            </div>
            <div class="info-card">
              <strong>Стиль</strong>
              <span>Логичный, четкий, с акцентом на разбор и структуру.</span>
            </div>
          </div>

          <div class="right-section">
            <h3>Память проекта</h3>
            <div class="info-card">
              <strong>Закрепленные правила</strong>
              <span>Не смешивать данные Gemini с Claude и ChatGPT.</span>
            </div>
            <div class="info-card">
              <strong>Факты проекта</strong>
              <span>Выводы, логика структуры, промежуточные решения и рабочие принципы.</span>
            </div>
          </div>

          <div class="right-section">
            <h3>История</h3>
            <div class="info-card">
              <strong>Быстрый доступ</strong>
              <span>Позже сюда можно вынести последние аналитические сессии и быстрый поиск.</span>
            </div>
          </div>

          <div class="footer-note">
            Это отдельная среда Gemini, не связанная с Claude и ChatGPT.
          </div>
        </aside>
      </div>
    `,
            image: `
      <div class="workspace">
        <aside class="panel">
          <div class="panel-header-row">
            <h2>Шаблоны</h2>
            <button class="mini-btn" type="button">Новый</button>
          </div>
          <p class="panel-text">Быстрые сценарии работы внутри модуля Image.</p>

          <div class="project-list">
            <div class="project-item active-project">
              <strong>Text-to-Image</strong>
              <span>Создание изображения по текстовому описанию</span>
            </div>
            <div class="project-item">
              <strong>Image Edit</strong>
              <span>Редактирование загруженного изображения</span>
            </div>
            <div class="project-item">
              <strong>Product Visual</strong>
              <span>Шаблон для рекламных и товарных изображений</span>
            </div>
          </div>

          <div class="subsection">
            <div class="panel-header-row">
              <h3>История запусков</h3>
              <button class="mini-btn" type="button">Все</button>
            </div>

            <div class="dialog-list">
              <div class="dialog-item active-dialog">
                <strong>Генерация постера</strong>
                <span>Запуск: 12 минут назад</span>
              </div>
              <div class="dialog-item">
                <strong>Правка баннера</strong>
                <span>Запуск: сегодня</span>
              </div>
              <div class="dialog-item">
                <strong>Обложка для гайда</strong>
                <span>Запуск: вчера</span>
              </div>
            </div>
          </div>

          <div class="footer-note">
            Позже здесь появятся фильтры, поиск и список последних изображений.
          </div>
        </aside>

        <section class="panel chat-panel">
          <div class="project-topbar">
            <div>
              <div class="project-top-label">Режим работы</div>
              <div class="project-top-title">Text-to-Image</div>
            </div>
            <div class="top-actions">
              <button class="ghost-btn" type="button">Сохранить шаблон</button>
              <button class="ghost-btn" type="button">Настройки модели</button>
            </div>
          </div>

          <h2>Генерация изображения</h2>
          <p class="panel-text">Центральная рабочая зона для запуска генерации через KIE API.</p>

          <div class="form-grid">
  <div class="form-block full-width">
    <label>Prompt</label>
    <textarea id="image-prompt" placeholder="Опишите, какое изображение нужно создать"></textarea>
  </div>

  <div class="form-block full-width">
    <label>Negative Prompt</label>
    <textarea id="image-negative-prompt" placeholder="Опишите, чего не должно быть в изображении"></textarea>
  </div>

  <div class="form-block">
    <label>Размер</label>
    <select id="image-size">
      <option>1024 × 1024</option>
      <option>1536 × 1024</option>
      <option>1024 × 1536</option>
    </select>
  </div>

  <div class="form-block">
    <label>Количество</label>
    <select id="image-count">
      <option>1</option>
      <option>2</option>
      <option>4</option>
    </select>
  </div>

  <div class="form-block">
    <label>Стиль</label>
    <select id="image-style">
      <option>Photoreal</option>
      <option>Editorial</option>
      <option>Cinematic</option>
    </select>
  </div>

  <div class="form-block">
    <label>Модель</label>
    <select id="image-model">
      <option>KIE Image Model</option>
      <option>Fast Image</option>
      <option>Edit Model</option>
    </select>
  </div>
</div>

<div class="action-row">
  <button class="primary-btn" type="button" id="image-generate-btn">Сгенерировать</button>
  <button class="ghost-btn" type="button" id="image-clear-btn">Очистить</button>
</div>
        </section>

        <aside class="panel">
          <div class="panel-header-row">
            <h2>Результат</h2>
            <button class="mini-btn" type="button">Files</button>
          </div>
          <p class="panel-text">Правая зона результата и дальнейших действий.</p>

          <div class="result-preview">
  <div class="result-placeholder" id="image-result-box">
    Preview результата появится здесь
  </div>
</div>

          <div class="right-section">
            <h3>Действия</h3>
            <div class="info-card">
              <strong>Сохранить в Files</strong>
              <span>Передача результата в общую файловую библиотеку.</span>
            </div>
            <div class="info-card">
              <strong>Отправить в Video</strong>
              <span>Использовать изображение как основу для video-модуля.</span>
            </div>
            <div class="info-card">
              <strong>Повторить генерацию</strong>
              <span>Повтор запуска с теми же параметрами и prompt.</span>
            </div>
          </div>

          <div class="footer-note">
            Позже здесь появятся реальные превью, download и действия с готовым файлом.
          </div>
        </aside>
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
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px;">
        <div>
          <h2 style="margin:0 0 8px;">Files</h2>
          <p style="margin:0; color:#9ca3af;">Реальная библиотека результатов из модулей.</p>
        </div>
        <button class="primary-btn" type="button" id="files-refresh-btn">Обновить</button>
      </div>

      <div id="files-list">Загрузка файлов...</div>
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
                    .form-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
          }

          .form-block {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .form-block label {
            font-size: 14px;
            color: #d1d5db;
          }

          .form-block textarea,
          .form-block select {
            width: 100%;
            border: 1px solid rgba(255,255,255,0.08);
            background: #20242a;
            color: #f3f4f6;
            border-radius: 14px;
            padding: 14px 16px;
            outline: none;
            font: inherit;
          }

          .form-block textarea {
            min-height: 110px;
            resize: vertical;
          }

          .full-width {
            grid-column: 1 / -1;
          }

          .action-row {
            display: flex;
            gap: 12px;
            margin-top: 18px;
            flex-wrap: wrap;
          }

          .primary-btn {
            border: 0;
            border-radius: 14px;
            background: #2b57d9;
            color: white;
            font-weight: 600;
            padding: 12px 18px;
            cursor: pointer;
          }

          .result-preview {
            margin-bottom: 18px;
          }

          .result-placeholder {
            min-height: 260px;
            border-radius: 18px;
            background: #20242a;
            border: 1px dashed rgba(255,255,255,0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #9ca3af;
            text-align: center;
            padding: 20px;
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
            .form-grid {
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
       <script>
  async function initImagePage() {
    const params = new URLSearchParams(window.location.search);
    const currentPage = params.get("page") || "dashboard";

    if (currentPage !== "image") return;

    const promptEl = document.getElementById("image-prompt");
    const negativePromptEl = document.getElementById("image-negative-prompt");
    const sizeEl = document.getElementById("image-size");
    const countEl = document.getElementById("image-count");
    const styleEl = document.getElementById("image-style");
    const modelEl = document.getElementById("image-model");
    const generateBtn = document.getElementById("image-generate-btn");
    const clearBtn = document.getElementById("image-clear-btn");
    const resultBox = document.getElementById("image-result-box");

    if (!generateBtn || !resultBox) return;

    generateBtn.addEventListener("click", async function () {
      const prompt = promptEl && "value" in promptEl ? promptEl.value.trim() : "";
      const negativePrompt = negativePromptEl && "value" in negativePromptEl ? negativePromptEl.value.trim() : "";
      const size = sizeEl && "value" in sizeEl ? sizeEl.value : "";
      const count = countEl && "value" in countEl ? countEl.value : "";
      const style = styleEl && "value" in styleEl ? styleEl.value : "";
      const model = modelEl && "value" in modelEl ? modelEl.value : "";

      if (!prompt) {
        resultBox.innerHTML = "Введите prompt перед запуском генерации.";
        return;
      }

      resultBox.innerHTML = "Создание задачи в KIE...";

      try {
        const response = await fetch("/api/image/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            prompt: prompt,
            negativePrompt: negativePrompt,
            size: size,
            count: count,
            style: style,
            model: model
          })
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
          resultBox.innerHTML = data.error || "Ошибка запроса";
          return;
        }

        const taskId = data.taskId;
        resultBox.innerHTML = "Задача создана. Ожидание результата...";

        let attempts = 0;
        const maxAttempts = 30;

        const poll = async function () {
          attempts += 1;

          try {
            const statusResponse = await fetch(
              "/api/image/status?taskId=" + encodeURIComponent(taskId)
            );

            const statusData = await statusResponse.json();

            if (!statusResponse.ok || !statusData.ok) {
              resultBox.innerHTML = statusData.error || "Ошибка проверки статуса";
              return;
            }

            if (statusData.status === "GENERATING") {
              resultBox.innerHTML = "Генерация в KIE... Попытка " + attempts + " из " + maxAttempts;

              if (attempts < maxAttempts) {
                setTimeout(poll, 3000);
              } else {
                resultBox.innerHTML = "Время ожидания истекло. Попробуйте проверить позже.";
              }
              return;
            }

            if (statusData.status === "SUCCESS" && statusData.imageUrl) {
              resultBox.innerHTML =
                '<div style="text-align:left; width:100%;">' +
                  '<div style="font-weight:700; margin-bottom:10px;">Изображение готово</div>' +
                  '<div style="margin-bottom:8px;"><strong>Task ID:</strong> ' + statusData.taskId + '</div>' +
                  '<div style="margin-bottom:8px;"><strong>Статус:</strong> ' + statusData.status + '</div>' +
                  '<div style="margin:14px 0;">' +
                    '<img src="' + statusData.imageUrl + '" alt="Generated image" style="width:100%; border-radius:14px; display:block; border:1px solid rgba(255,255,255,0.08);" />' +
                  '</div>' +
                  '<div style="margin-bottom:14px;">' +
                    '<a href="' + statusData.imageUrl + '" target="_blank" rel="noopener noreferrer" style="color:#93c5fd;">Открыть результат в новой вкладке</a>' +
                  '</div>' +
                  '<div style="color:#9ca3af;">Следующим шагом можно сохранить изображение в Files и добавить историю генераций.</div>' +
                '</div>';
              return;
            }

            resultBox.innerHTML =
              "Ошибка генерации: " +
              (statusData.errorMessage || statusData.status || "Неизвестная ошибка");
          } catch (error) {
            resultBox.innerHTML = "Не удалось проверить статус задачи.";
          }
        };

        setTimeout(poll, 2500);
      } catch (error) {
        resultBox.innerHTML = "Не удалось отправить запрос.";
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (promptEl && "value" in promptEl) promptEl.value = "";
        if (negativePromptEl && "value" in negativePromptEl) negativePromptEl.value = "";
        resultBox.innerHTML = "Preview результата появится здесь";
      });
    }
  }

  async function initFilesPage() {
    const params = new URLSearchParams(window.location.search);
    const currentPage = params.get("page") || "dashboard";

    if (currentPage !== "files") return;

    const listEl = document.getElementById("files-list");
    const refreshBtn = document.getElementById("files-refresh-btn");

    if (!listEl) return;

    const loadFiles = async function () {
      listEl.innerHTML = "Загрузка файлов...";

      try {
        const response = await fetch("/api/files");
        const data = await response.json();

        if (!response.ok || !data.ok) {
          listEl.innerHTML = data.error || "Не удалось загрузить файлы.";
          return;
        }

        const files = Array.isArray(data.files) ? data.files : [];

        if (!files.length) {
          listEl.innerHTML = "Пока нет сохранённых файлов.";
          return;
        }

        listEl.innerHTML = files.map(function (file) {
  const createdAt = file.createdAt
    ? new Date(file.createdAt).toLocaleString("ru-RU")
    : "-";

  return (
    '<div style="background:linear-gradient(180deg,#1b1f25 0%,#171b21 100%); border:1px solid rgba(255,255,255,0.06); border-radius:18px; padding:18px; margin-bottom:16px; box-shadow:0 10px 30px rgba(0,0,0,0.18);">' +
      '<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px;">' +
        '<div>' +
          '<div style="font-size:16px; font-weight:700; color:#f3f4f6; margin-bottom:6px;">' + (file.name || "Без имени") + '</div>' +
          '<div style="display:flex; flex-wrap:wrap; gap:8px;">' +
            '<span style="display:inline-flex; align-items:center; padding:6px 10px; border-radius:999px; background:rgba(59,130,246,0.12); color:#bfdbfe; font-size:12px; font-weight:600;">' + (file.type || "-") + '</span>' +
            '<span style="display:inline-flex; align-items:center; padding:6px 10px; border-radius:999px; background:rgba(255,255,255,0.06); color:#d1d5db; font-size:12px;">' + (file.source || "-") + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      (
        file.url
          ? '<div style="margin-bottom:14px;">' +
              '<img src="' + file.url + '" alt="' + (file.name || "file") + '" style="width:100%; max-width:460px; border-radius:16px; display:block; border:1px solid rgba(255,255,255,0.08);" />' +
            '</div>'
          : ''
      ) +

      '<div style="display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px;">' +
        '<div style="color:#9ca3af; font-size:13px;">Создан: ' + createdAt + '</div>' +
        (
          file.url
            ? '<a href="' + file.url + '" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; justify-content:center; padding:10px 14px; border-radius:12px; background:#2563eb; color:#ffffff; text-decoration:none; font-weight:600; font-size:14px;">Открыть файл</a>'
            : '<div style="color:#9ca3af; font-size:13px;">URL файла отсутствует</div>'
        ) +
      '</div>' +
    '</div>'
  );
}).join("");
      } catch (error) {
        listEl.innerHTML = "Не удалось загрузить файлы.";
      }
    };

    if (refreshBtn) {
      refreshBtn.addEventListener("click", loadFiles);
    }

    loadFiles();
  }

  initImagePage();
  initFilesPage();
</script>
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
