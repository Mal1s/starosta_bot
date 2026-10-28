# Староста бот

Telegram Mini App для учебной группы: расписание, ежедневный опрос посещаемости, журнал, объявления и статистика.

## Бот

- **Название:** Староста — расписание и журнал
- **Username:** @starostaa_help_bot
- **Описание:** Расписание, опросы «буду на парах?» и журнал посещаемости для твоей группы. Бесплатно.

## Возможности

- **Староста** управляет группой: расписание, журнал посещаемости, объявления, настройки, передача роли
- **Студент** отвечает на опрос одним тапом, видит расписание и статистику
- **Два слоя посещаемости:** заявлено (ответ студента) и факт (отметка старосты)
- **Подгруппы:** пары, студенты, опросы и объявления по подгруппам
- **Объявления нельзя отключить** — блокирующий экран в Mini App и напоминания в чате
- **Приватность:** причины пропусков видит только староста
- **6 тем и 5 фонов** оформления
- **Dev-режим** с моковыми данными для предпросмотра без Telegram

## Стек

React 18, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, Zustand, Zod, date-fns, Supabase (Postgres, Edge Functions)

## Dev-режим

По умолчанию включён dev-режим (`VITE_DEV_MOCK=true` в `.env`). В нём:
- Переключатель «Войти как» в левом верхнем углу (староста / зам / студент 1 / студент 2)
- Демо-группа «ПИ-21» с 12 студентами, расписанием и объявлениями
- Запросы идут к локальному моку, не к серверу

Для подключения реального бэкенда установите `VITE_DEV_MOCK=false`.

---

## Настройка в BotFather (уже сделано)

Бот создан: @starostaa_help_bot

### Тексты бота

**About** (короткий текст в профиле, до 120 символов):
```
Расписание, опросы «буду на парах?» и журнал посещаемости для твоей группы. Бесплатно.
```

**Description** (экран перед первым запуском, до 512 символов):
```
Староста бот помогает группе жить без хаоса.

📅 Расписание всегда под рукой, с отменами и переносами
✅ Один тап в день: буду на парах или нет
📊 Журнал посещаемости и статистика для старосты
📣 Объявления, которые не потеряются
🤒 Больничный и отгулы на несколько дней

Староста создаёт группу и делится ссылкой, студенты заходят по ссылке и коду. Всё бесплатно, без рекламы.
```

**Commands:**
```
start - Начать и выбрать роль
app - Открыть приложение
help - Как пользоваться
```

### Настройки BotFather

- **Allow Groups?** → Disable (бот работает только в личке)
- **Inline Mode** → выключено
- **Group Privacy** → не важно (группы выключены)

### Картинки

- **Botpic** (аватар): квадрат, PNG или JPG, 640×640+
- **Description Picture** (баннер «Что умеет бот»): 640×360

---

## Настройка Mini App (нужно сделать после деплоя)

### 1. Menu Button — кнопка в меню бота

В BotFather:
```
/setmenubutton
```
Выберите @starostaa_help_bot и отправьте:
- **URL:** `https://<ВАШ-АДРЕС>.netlify.app` (адрес задеплоенного Mini App)
- **Текст кнопки:** Открыть приложение

Или через Bot API (замените `<TOKEN>` на токен бота):
```
https://api.telegram.org/bot9283014051:AAGhmUJ2r0FWVn55yFeDlmYUgOVMQvCxljk/setChatMenuButton

POST body (JSON):
{
  "menu_button": {
    "type": "web_app",
    "text": "Открыть приложение",
    "web_app": {
      "url": "https://<ВАШ-АДРЕС>.netlify.app"
    }
  }
}
```

### 2. Web App URL — для ссылок приглашения

В BotFather:
```
/settings
```
Выберите @starostaa_help_bot → **Web App** → отправьте URL:
```
https://<ВАШ-АДРЕС>.netlify.app
```

Это нужно, чтобы ссылки вида `https://t.me/starostaa_help_bot?startapp=<token>` открывали Mini App.

### 3. Установка Webhook

После деплоя Edge Function `bot-webhook`:

```
https://api.telegram.org/bot9283014051:AAGhmUJ2r0FWVn55yFeDlmYUgOVMQvCxljk/setWebhook

POST body (JSON):
{
  "url": "https://<PROJECT_REF>.supabase.co/functions/v1/bot-webhook",
  "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
}
```

Где:
- `<PROJECT_REF>` — ID проекта Supabase (из URL проекта)
- `<TELEGRAM_WEBHOOK_SECRET>` — случайная строка, должна совпадать с секретом в Supabase

Проверить, что webhook установлен:
```
https://api.telegram.org/bot9283014051:AAGhmUJ2r0FWVn55yFeDlmYUgOVMQvCxljk/getWebhookInfo
```

---

## Переменные окружения

### Клиентские (`.env`)

| Переменная | Значение |
|---|---|
| `VITE_SUPABASE_URL` | URL проекта Supabase |
| `VITE_BOT_USERNAME` | `starostaa_help_bot` |
| `VITE_DEV_MOCK` | `true` для dev-режима, `false` для реального бэкенда |

### Секреты Supabase (Edge Functions)

| Секрет | Описание |
|---|---|
| `TELEGRAM_BOT_TOKEN` | `9283014051:AAGhmUJ2r0FWVn55yFeDlmYUgOVMQvCxljk` |
| `TELEGRAM_WEBHOOK_SECRET` | Случайная строка для проверки webhook |
| `BOT_USERNAME` | `starostaa_help_bot` |
| `APP_URL` | Адрес Mini App на Netlify |
| `GEMINI_API_KEY` | API ключ Google Gemini (распознавание расписания) |
| `GEMINI_MODEL` | Модель Gemini (например, `gemini-1.5-pro`) |
| `ADMIN_TELEGRAM_ID` | Ваш Telegram ID |
| `CRON_SECRET` | Секрет для вызова scheduler-tick из pg_cron |

---

## Деплой

### Фронтенд (Netlify)

1. Подключите репозиторий к Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Добавьте переменные окружения:
   - `VITE_SUPABASE_URL` — URL проекта Supabase
   - `VITE_BOT_USERNAME` — `starostaa_help_bot`
   - `VITE_DEV_MOCK` — `false` (для production)
5. После деплоя возьмите URL (например `https://starosta-bot.netlify.app`)
6. Укажите этот URL в BotFather → Menu Button и Web App

### Бэкенд (Supabase)

1. Создайте проект Supabase
2. Включите расширения `pg_cron` и `pg_net`
3. Запустите миграции из `supabase/migrations/`
4. Задайте секреты Edge Functions (см. таблицу выше)
5. Задеплойте Edge Functions: `api`, `bot-webhook`, `scheduler-tick`
6. Установите webhook бота (см. выше)
7. Настройте pg_cron (миграция `0004_cron.sql`)

---

## Команда /app

Команда `/app` открывает Mini App напрямую. В обработчике `bot-webhook`:

```typescript
if (text === '/app') {
  await sendMessage(chatId, 'Открываю приложение…', {
    reply_markup: {
      inline_keyboard: [[{
        text: 'Открыть приложение',
        web_app: { url: `${APP_URL}` }
      }]]
    }
  });
}
```
