# Староста бот

Telegram Mini App для учебной группы: расписание, ежедневный опрос посещаемости, журнал, объявления и статистика.

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

## Инструкция: настройка в BotFather

### 1. Создание бота

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Отправьте `/newbot`
3. Введите имя бота: **Староста бот**
4. Введите username бота (должен заканчиваться на `bot`): например, `my_group_starosta_bot`
5. Скопируйте **токен** (вида `123456789:ABCdefGhIJKlmNoPQRsTUVwxyz`) — он нужен для секрета `TELEGRAM_BOT_TOKEN`

### 2. Описание бота

Отправьте BotFather следующие команды:

```
/setdescription
```
Выберите вашего бота и отправьте:
```
Расписание, опросы и журнал посещаемости для твоей учебной группы. Староста управляет расписанием и журналом, студенты отвечают на опрос одним тапом.
```

```
/setabouttext
```
Отправьте:
```
Староста бот — помощник для учебной группы: расписание, опросы посещаемости, журнал, объявления и статистика.
```

### 3. Команды бота

```
/setcommands
```
Отправьте:
```
start - Начать работу с ботом
help - Помощь и инструкция
```

### 4. Настройка Mini App (Menu Button)

```
/setmenubutton
```
Выберите бота и отправьте:
- **URL:** адрес вашего задеплоенного Mini App (например, `https://your-app.netlify.app`)
- **Текст кнопки:** Открыть приложение

Также можно задать через Bot API:
```
https://api.telegram.org/bot<TOKEN>/setChatMenuButton?
  chat_id=<CHAT_ID>
  &menu_button={"type":"web_app","text":"Открыть приложение","web_app":{"url":"https://your-app.netlify.app"}}
```

### 5. Настройка Web App (для ссылок приглашения)

```
/settings
```
Выберите бота → **Web App** → отправьте URL вашего Mini App.

Это нужно, чтобы ссылки вида `https://t.me/<BOT_USERNAME>?startapp=<token>` открывали Mini App.

### 6. Установка Webhook

После деплоя Edge Function `bot-webhook` установите webhook:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?
  url=https://<PROJECT_REF>.supabase.co/functions/v1/bot-webhook
  &secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

Где:
- `<TOKEN>` — токен бота от BotFather
- `<PROJECT_REF>` — ID проекта Supabase
- `<TELEGRAM_WEBHOOK_SECRET>` — случайная строка (должна совпадать с секретом в Supabase)

### 7. Иконка бота

```
/setuserpic
```
Отправьте квадратное изображение (минимум 600×600 px) — логотип приложения.

---

## Переменные окружения

### Клиентские (`.env`)

| Переменная | Описание |
|---|---|
| `VITE_SUPABASE_URL` | URL проекта Supabase |
| `VITE_BOT_USERNAME` | username бота без `@` |
| `VITE_DEV_MOCK` | `true` для dev-режима с моком, `false` для реального бэкенда |

### Секреты Supabase (Edge Functions)

| Секрет | Описание |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Токен бота от BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Случайная строка для проверки webhook |
| `BOT_USERNAME` | Имя бота без `@` |
| `APP_URL` | Адрес Mini App на Netlify |
| `GEMINI_API_KEY` | API ключ Google Gemini (распознавание расписания) |
| `GEMINI_MODEL` | Модель Gemini (например, `gemini-1.5-pro`) |
| `ADMIN_TELEGRAM_ID` | Telegram ID администратора проекта |
| `CRON_SECRET` | Секрет для вызова scheduler-tick из pg_cron |

---

## Деплой

### Фронтенд (Netlify)

1. Подключите репозиторий к Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Добавьте переменные окружения
5. Укажите адрес в `APP_URL` и в BotFather → Menu Button

### Бэкенд (Supabase)

1. Создайте проект Supabase
2. Включите расширения `pg_cron` и `pg_net`
3. Запустите миграции из `supabase/migrations/`
4. Задайте секреты Edge Functions
5. Задеплойте Edge Functions: `api`, `bot-webhook`, `scheduler-tick`
6. Установите webhook бота (см. выше)
7. Настройте pg_cron (миграция `0004_cron.sql`)
