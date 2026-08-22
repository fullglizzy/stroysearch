# stroysearch — платформа ЕНЦПР

Поиск поставщиков и заказчиков, матрица материалов, продуктовая библиотека,
встречи и конференции, опросы, геймификация (монеты/подарки) и финансы.

## Стек

- Next.js 16 (App Router), React 19, TypeScript
- Prisma + SQLite (WAL-режим)
- Tailwind CSS 4, shadcn/ui (base-ui)
- next-auth v5 (Credentials), argon2
- Почта: self-hosted Postal (без `POSTAL_API_URL`/`POSTAL_API_KEY` письма отключены)

## Локальная разработка

```bash
npm ci
cp .env.example .env   # DATABASE_URL="file:./dev.db"
npx prisma migrate deploy
npx prisma db seed
npx tsx prisma/seed-classifier.ts   # дерево классификатора
npm run dev
```

Проверка перед коммитом: `npm run lint` и `npx tsc --noEmit`.

## Прод-деплой на VPS

Готовый деплой-пакет лежит в `deploy/` (ветка `prod-clean`):

```bash
git clone -b prod-clean https://github.com/fullglizzy/stroysearch.git
cd stroysearch
sudo bash deploy/deploy.sh ваш-домен.ru admin@ваш-домен.ru
```

Скрипт идемпотентен: первый запуск — установка пакетов, база, сиды, SSL, cron-бэкапы;
последующие — обновление кода, миграции, пересборка, рестарт.

Что делает `deploy.sh`:

1. Устанавливает Node 22, Nginx, certbot, pm2; создаёт пользователя `deploy`.
2. Клонирует ветку `prod-clean` в `/opt/stroysearch`.
3. Создаёт `.env` (секрет генерируется) — база `file:/opt/stroysearch/prisma/prod.db`.
4. Применяет миграции; при первом запуске — сиды (базовые данные, классификатор, searchText).
5. Собирает `next build` (standalone) и раскладывает: `.next/static`, `public`, `.env`.
6. Загруженные файлы живут в `/var/lib/stroysearch/uploads` вне репозитория
   (симлинк в standalone) — обновления их не затирают.
7. Запускает приложение под PM2 (`stroysearch`, автозапуск при ребуте), Nginx + Let's Encrypt.
8. Ставит ежедневные бэкапы (SQLite-снапшот + uploads, хранение 14 дней).

Обновление прода: `sudo bash /opt/stroysearch/deploy/deploy.sh`.

Требования к VPS: 2–4 vCPU, 4 ГБ RAM, 60+ ГБ NVMe SSD, Ubuntu 22.04/24.04.
На 150–200 одновременных пользователей одной машины достаточно; 2000+ онлайн — выносить БД
и `public/uploads` на отдельные сервисы.

## Структура

- `src/app` — страницы и API-роуты (App Router)
- `src/components` — UI-компоненты
- `src/lib` — серверные модули (auth, billing, invoices, mailer, валидаторы)
- `src/server` — серверная логика (дерево классификатора, регионы, аудит)
- `prisma` — схема БД и сиды
- `deploy` — деплой-пакет для VPS
