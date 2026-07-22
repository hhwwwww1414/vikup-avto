# VIKUP

Внутренний веб-сервис для команды, ищущей автомобили для выкупа. Менеджер
фотографирует автомобиль, отправляет фото Telegram-боту, система автоматически
находит и распознаёт российский госномер (ANPR), сохраняет оригинал в S3 и
создаёт карточку в «Гараже».

```
Сфотографировал → отправил в Telegram → распознан госномер → сохранено фото и данные → карточка в Гараже
```

---

## 1. Архитектура

Один VPS, всё в Docker Compose:

```
Internet
  → vikup.ghostpepe.fun
    → Caddy (reverse proxy, авто-HTTPS Let's Encrypt)
      → web  (Next.js: auth, Гараж, админка, аналитика, Telegram webhook, S3)
        → ocr (Python FastAPI: локальный ANPR/OCR, ТОЛЬКО внутри сети)
      → PostgreSQL (внешний managed)
      → S3-compatible storage (внешний)
```

- **PostgreSQL** — внешний managed сервис (не поднимается на VPS).
- **S3** — внешнее объектное хранилище (оригиналы фото и миниатюры).
- **ocr** — не публикуется наружу, доступен только контейнеру `web`.
- Наружу открыты только порты **80** и **443** (Caddy) и **22** (SSH).

## 2. Stack

| Слой        | Технология                                                        |
|-------------|-------------------------------------------------------------------|
| Web/Backend | Next.js 14 (App Router), TypeScript, React, Tailwind CSS          |
| Auth        | JWT-сессия в HttpOnly cookie (`jose`), bcrypt-хеш паролей         |
| ORM/DB      | Prisma + PostgreSQL                                                |
| Storage     | S3-compatible (`@aws-sdk/client-s3`), миниатюры через `sharp`     |
| ANPR/OCR    | Python, FastAPI, ONNX: `open-image-models` (детектор номеров YOLOv9) + `fast-plate-ocr` (OCR) |
| Proxy/HTTPS | Caddy 2 (автоматический Let's Encrypt)                             |
| Deploy      | Docker Compose                                                     |

ANPR полностью **локальный, open-source и бесплатный** (без платных Vision API).
Модели ONNX лёгкие (CPU), лицензия MIT.

---

## 3. Local development

Требуется Node.js 20+ и (для OCR) Python 3.11+.

### Web

```bash
cd web
cp ../.env.example ../.env        # заполнить значения
npm install
npm run migrate                   # применить миграции к БД
ADMIN_LOGIN=admin ADMIN_PASSWORD=secret123 ADMIN_NAME="Admin" npm run create-admin
npm run dev                       # http://localhost:3000
```

Переменные окружения web читает из `.env` (в dev — через `env_file`/`dotenv` вашей
среды; в проде их передаёт docker-compose). Для локального запуска можно
положить `.env` в `web/` или экспортировать переменные в shell.

### OCR (опционально локально)

```bash
cd ocr
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --port 8000       # POST /recognize (multipart file=...)
```

### Полезные команды (web)

```bash
npm run dev         # dev-сервер
npm run build       # production-сборка (prisma generate + next build)
npm run start       # production-сервер
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run test        # unit-тесты (нормализация госномеров)
npm run migrate     # prisma migrate deploy
npm run create-admin# создать/проверить первого ADMIN
```

---

## 4. Environment variables

Полный список — в [`.env.example`](.env.example). Ключевые:

| Переменная               | Назначение                                              |
|--------------------------|---------------------------------------------------------|
| `APP_URL`                | Публичный URL (`https://vikup.ghostpepe.fun`)           |
| `DATABASE_URL`           | Строка подключения PostgreSQL (`?sslmode=require`)      |
| `AUTH_SECRET`            | Секрет подписи сессий (`openssl rand -base64 48`)        |
| `TELEGRAM_BOT_TOKEN`     | Токен бота                                               |
| `TELEGRAM_WEBHOOK_SECRET`| Секрет заголовка webhook (`openssl rand -hex 24`)        |
| `S3_*`                   | Доступы к объектному хранилищу                           |
| `OCR_CONFIDENCE_MIN`     | Порог уверенности OCR для создания карточки (0..1)       |
| `ADMIN_LOGIN/PASSWORD`   | Первый ADMIN (используется один раз при первом старте)   |

Секреты **не коммитятся**. Продовый `.env` живёт только на сервере
(`/opt/vikup/.env`).

---

## 5. Database migrations

Схема управляется через Prisma migrations (`web/prisma/migrations`).

```bash
cd web
npm run migrate        # prisma migrate deploy — применяет все миграции
```

В проде миграции применяются автоматически при старте контейнера `web`
(см. `web/Dockerfile` CMD). Создавать таблицы вручную нельзя — только через
миграции.

## 6. Создание первого ADMIN

```bash
# Локально или на сервере, внутри контейнера web:
ADMIN_LOGIN=admin ADMIN_PASSWORD='<strong>' ADMIN_NAME='Администратор' npm run create-admin
```

- Скрипт **идемпотентный**: если пользователь с таким login уже есть — пароль
  не перезаписывается. Повторные деплои безопасны.
- Сбросить пароль существующего админа: `npm run create-admin -- --reset-password`.

На проде эти переменные заданы в `.env`, и `create-admin` вызывается при старте
контейнера. После создания админа можно убрать `ADMIN_PASSWORD` из `.env`.

Новых менеджеров/админов далее создаёт ADMIN в интерфейсе `/managers`.

---

## 7. Telegram Bot setup

1. Бот уже создан у @BotFather, токен — в `TELEGRAM_BOT_TOKEN`.
2. Каждому менеджеру в `/managers` укажите его **Telegram user_id** (числовой ID;
   узнать можно у бота `@userinfobot`). Только активные пользователи с
   привязанным `telegram_id` могут отправлять фото. Остальные получают
   `⛔ У вас нет доступа к VIKUP.`

## 8. Telegram webhook setup

Продакшн использует webhook (не long polling):

```
POST https://vikup.ghostpepe.fun/api/telegram/webhook
```

Установка webhook (выполняется один раз после деплоя):

```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://vikup.ghostpepe.fun/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
  -d "allowed_updates=[\"message\"]" \
  -d "drop_pending_updates=true"
```

Проверить: `curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"`.

Webhook защищён секретным заголовком `X-Telegram-Bot-Api-Secret-Token`, который
проверяется на сервере.

## 9. S3 setup

- Бакет S3-совместимый; ключи объектов: `vehicles/YYYY/MM/{uuid}.jpg` (оригинал)
  и `vehicles/YYYY/MM/{uuid}.thumb.jpg` (миниатюра для сетки).
- Оригиналы **не** публикуются напрямую: изображения отдаются авторизованным
  пользователям через прокси `GET /api/image?key=...` (проверка сессии + белый
  список ключей). Бакет можно держать приватным.
- Настройки — в `S3_*` переменных. Для Timeweb/Selectel и подобных используйте
  `S3_FORCE_PATH_STYLE=true`.

## 10. OCR / ANPR setup

Pipeline (полностью локально, на CPU):

```
фото → детекция номера (YOLOv9 ONNX) → crop (+паддинг) → варианты препроцессинга
(upscale / CLAHE-контраст / резкость) → OCR (fast-plate-ocr ONNX) → выбор лучшего
результата → русская нормализация и валидация (на стороне Node) → номер
```

- Модели ONNX скачиваются и **вшиваются в образ** на этапе `docker build`
  (быстрый и офлайн-устойчивый старт).
- Русская пост-обработка: латинские look-alike → кириллица
  (`A→А, B→В, E→Е, K→К, M→М, H→Н, O→О, P→Р, C→С, T→Т, Y→У, X→Х`), контекстная
  коррекция по позиции символа (буква/цифра), проверка формата
  `L DDD LL RR(R)`. Невалидный результат карточку **не** создаёт.
- Порог уверенности — `OCR_CONFIDENCE_MIN` (по умолчанию 0.4).

### Benchmark на реальных фото (TZ §48/§61)

```bash
cd ocr
# expected.csv (необязательно): строки "имя_файла,О101НТ790"
python benchmark.py ./test_images ./expected.csv
```

Выводит: `total, correct, failed, wrong, accuracy, average_processing_time`.

---

## 11. Production deployment

Требования на VPS: Docker + Docker Compose plugin, открытые порты 80/443/22, DNS
`vikup.ghostpepe.fun → IP VPS`.

```bash
# 1. Клонировать
sudo mkdir -p /opt/vikup && cd /opt/vikup
git clone https://github.com/hhwwwww1414/vikup-avto .

# 2. Создать продовый .env (НЕ в git)
cp .env.example .env
nano .env            # заполнить DATABASE_URL, AUTH_SECRET, TELEGRAM_*, S3_*, ADMIN_*

# 3. Собрать и запустить
docker compose up -d --build

# 4. Проверить
docker compose ps
curl -s https://vikup.ghostpepe.fun/api/health   # {"status":"ok"}

# 5. Установить Telegram webhook (см. раздел 8)
```

Миграции и создание ADMIN выполняются автоматически при первом старте `web`.
Caddy сам получит TLS-сертификат Let's Encrypt.

> На VPS с 2 ГБ RAM рекомендуется swap (сборка Next.js требовательна к памяти):
> ```bash
> fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
> echo '/swapfile none swap sw 0 0' >> /etc/fstab
> ```

## 12. Как обновить production

```bash
cd /opt/vikup
git pull
docker compose up -d --build
```

Проверить health и логи после обновления (раздел 14).

---

## 13. Backup basics

### PostgreSQL

```bash
pg_dump "$DATABASE_URL" -Fc -f vikup_$(date +%F).dump
# восстановление:
pg_restore -d "$DATABASE_URL" --clean vikup_YYYY-MM-DD.dump
```

### S3

Фотографии уже хранятся отдельно в объектном хранилище (durable). Отдельная
backup-платформа не требуется; при необходимости используйте `rclone`/`aws s3
sync` для копии бакета.

---

## 14. Эксплуатация и troubleshooting

```bash
cd /opt/vikup

docker compose ps                 # статус сервисов
docker compose logs -f web        # логи приложения
docker compose logs -f ocr        # логи OCR
docker compose logs -f caddy      # логи прокси/TLS
docker compose restart web        # перезапуск сервиса
docker compose up -d --build      # пересобрать и поднять
docker compose down               # остановить всё
```

Типичные проблемы:

- **Нет HTTPS / сертификат не выдаётся** — проверьте, что DNS указывает на VPS и
  порты 80/443 открыты; смотрите `docker compose logs caddy`.
- **Бот не отвечает** — проверьте `getWebhookInfo`, совпадение
  `TELEGRAM_WEBHOOK_SECRET`, логи `web`.
- **«Не удалось распознать»** — номер мелкий/сильный угол/плохой свет; отправьте
  более чёткое фото. Порог можно понизить через `OCR_CONFIDENCE_MIN`.
- **OCR долго стартует** — первый старт грузит модели; в образ они уже вшиты, но
  прогрев занимает время (`start_period` в healthcheck).
- **Health = degraded** — недоступна БД; проверьте `DATABASE_URL` и сеть.

### Поведение при дубликатах

Если распознанный нормализованный номер уже есть в БД, новая карточка **не
создаётся**; менеджер получает ответ, что автомобиль уже в гараже. Это самая
простая политика (без истории обнаружений), как допускает ТЗ.

### Перезапуск / автозапуск

Все сервисы имеют `restart: unless-stopped` и поднимаются автоматически после
перезагрузки VPS (Docker daemon включён в systemd). Webhook переживает
перезапуск (это состояние на стороне Telegram).

---

## 15. Роли и доступ

- **ADMIN**: весь гараж, все менеджеры (создание/редактирование/блокировка),
  привязка Telegram ID, аналитика.
- **MANAGER**: гараж, карточки, поиск по номеру, отправка фото боту.

Проверка ролей — на сервере (middleware + серверные экшены). MANAGER не получит
админ-страницы подменой URL.

## 16. Лицензии сторонних моделей

- [`open-image-models`](https://github.com/ankandrew/open-image-models) — MIT.
- [`fast-plate-ocr`](https://github.com/ankandrew/fast-plate-ocr) — MIT.

Веса моделей ONNX распространяются авторами вместе с библиотеками и скачиваются
при сборке образа.
