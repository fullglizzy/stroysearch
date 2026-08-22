#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Деплой stroysearch на VPS (Ubuntu 22.04/24.04)
#
# Первый запуск (от root):
#   sudo bash deploy/deploy.sh ваш-домен.ru [email-для-сертификата]
#   e.g.  sudo bash deploy/deploy.sh stroysearch.ru admin@stroysearch.ru
#
# Обновление из репозитория (тот же скрипт, от root):
#   sudo bash deploy/deploy.sh
#
# Переменные окружения (опционально, для первого запуска):
#   POSTAL_API_URL, POSTAL_API_KEY — почта через Postal
#   REPO_URL — адрес репозитория (по умолчанию fullglizzy/stroysearch)
#   BRANCH  — ветка для деплоя (по умолчанию prod-clean)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${1:-}"
CERTBOT_EMAIL="${2:-}"
REPO_URL="${REPO_URL:-https://github.com/fullglizzy/stroysearch.git}"
BRANCH="${BRANCH:-prod-clean}"
APP_DIR="/opt/stroysearch"
UPLOADS_DIR="/var/lib/stroysearch/uploads"
BACKUP_DIR="/var/backups/stroysearch"
RUN_USER="deploy"
APP_PORT=3000

if [ "$(id -u)" != "0" ]; then
  echo "Ошибка: запустите от root (sudo bash deploy/deploy.sh ...)" >&2
  exit 1
fi

# ── 1. Пакеты: Node 22, Nginx, git, sqlite3, certbot, pm2 ────────────────────
echo "==> Установка системных пакетов"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git nginx sqlite3 certbot python3-certbot-nginx ca-certificates curl gnupg

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]; then
  echo "==> Установка Node.js 22 LTS"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
npm i -g pm2 >/dev/null 2>&1 || true

# ── 2. Пользователь deploy и структура каталогов ─────────────────────────────
echo "==> Пользователь $RUN_USER и каталоги"
id -u "$RUN_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$RUN_USER"
mkdir -p "$APP_DIR" "$UPLOADS_DIR" "$BACKUP_DIR"
chown -R "$RUN_USER:$RUN_USER" "$APP_DIR" "$UPLOADS_DIR" "$BACKUP_DIR"

run_as() { sudo -u "$RUN_USER" -H bash -c "$*"; }

# ── 3. Код: clone (первый раз) или pull (обновление) ────────────────────────
if [ ! -d "$APP_DIR/.git" ]; then
  echo "==> Клонирование $BRANCH"
  run_as "cd $APP_DIR && git clone --branch $BRANCH --single-branch $REPO_URL ."
else
  echo "==> Обновление кода ($BRANCH)"
  run_as "cd $APP_DIR && git fetch origin $BRANCH && git checkout $BRANCH && git reset --hard origin/$BRANCH"
fi

echo "==> npm ci"
run_as "cd $APP_DIR && npm ci"

# ── 4. .env (создаётся один раз) ─────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
  if [ -z "$DOMAIN" ]; then
    echo "Ошибка: первый запуск требует домен: sudo bash deploy/deploy.sh ваш-домен.ru [email]" >&2
    exit 1
  fi
  echo "==> Создание .env"
  AUTH_SECRET="$(openssl rand -base64 32)"
  cat > "$APP_DIR/.env" <<EOF
DATABASE_URL="file:$APP_DIR/prisma/prod.db"
AUTH_SECRET="$AUTH_SECRET"
NEXT_PUBLIC_APP_URL="https://$DOMAIN"
NEXT_PUBLIC_APP_NAME="${NEXT_PUBLIC_APP_NAME:-ЕНЦПР}"
POSTAL_API_URL="${POSTAL_API_URL:-}"
POSTAL_API_KEY="${POSTAL_API_KEY:-}"
POSTAL_FROM="${POSTAL_FROM:-}"
NODE_ENV="production"
EOF
  chown "$RUN_USER:$RUN_USER" "$APP_DIR/.env"
else
  echo "==> .env уже существует — пропуск"
fi

# ── 5. База данных: миграции, сид (только при первом деплое), WAL ────────────
DB_FILE="$APP_DIR/prisma/prod.db"
echo "==> Миграции"
run_as "cd $APP_DIR && npx prisma migrate deploy"

if [ ! -f "$DB_FILE" ]; then
  echo "==> Первичное наполнение (seed, классификатор, searchText)"
  run_as "cd $APP_DIR && npx prisma db seed && npx tsx prisma/seed-classifier.ts && npx tsx scripts/backfill-searchtext.ts"
else
  echo "==> База существует — сид пропущен"
fi

echo "==> WAL-режим"
run_as "cd $APP_DIR && npx prisma db execute --stdin <<< 'PRAGMA journal_mode=WAL;'"

# ── 6. Прод-сборка ───────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL="$(grep '^NEXT_PUBLIC_APP_URL=' "$APP_DIR/.env" | cut -d= -f2- | tr -d '"')"
echo "==> next build (NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL)"
run_as "cd $APP_DIR && NEXT_PUBLIC_APP_URL='$NEXT_PUBLIC_APP_URL' npx next build"

# ── 7. Standalone: static, public, симлинк на постоянные загрузки ───────────
echo "==> Подготовка standalone"
STANDALONE="$APP_DIR/.next/standalone"
run_as "cd $APP_DIR && rm -rf $STANDALONE/public && mkdir -p $STANDALONE/public && rsync -a public/ $STANDALONE/public/ && cp -r .next/static $STANDALONE/.next/static && cp .env $STANDALONE/.env && ln -sfn $UPLOADS_DIR $STANDALONE/public/uploads"

# ── 8. PM2 (перезапуск или первый старт) ─────────────────────────────────────
echo "==> PM2"
if sudo -u "$RUN_USER" -H pm2 describe stroysearch >/dev/null 2>&1; then
  sudo -u "$RUN_USER" -H pm2 restart stroysearch --update-env
else
  sudo -u "$RUN_USER" -H pm2 start "$STANDALONE/server.js" --name stroysearch --max-memory-restart 1500
  sudo -u "$RUN_USER" -H pm2 save
  # unit автозапуска создаётся от root, но с -u deploy — daemon остаётся у deploy
  pm2 startup systemd -u "$RUN_USER" --hp "/home/$RUN_USER" >/dev/null 2>&1 || true
fi

# ── 9. Nginx + SSL ───────────────────────────────────────────────────────────
if [ -n "$DOMAIN" ]; then
  echo "==> Nginx: $DOMAIN"
  sed "s/%DOMAIN%/$DOMAIN/g; s/%PORT%/$APP_PORT/g" "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/stroysearch
  ln -sfn /etc/nginx/sites-available/stroysearch /etc/nginx/sites-enabled/stroysearch
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx

  if [ -n "$CERTBOT_EMAIL" ] && [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "==> Let's Encrypt"
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" -m "$CERTBOT_EMAIL" --agree-tos --non-interactive --redirect || \
      echo "Внимание: certbot не завершился — запустите вручную: certbot --nginx -d $DOMAIN -d www.$DOMAIN"
  fi
fi

# ── 10. Бэкапы по cron (устанавливаются один раз) ────────────────────────────
if ! crontab -l 2>/dev/null | grep -q "stroysearch"; then
  echo "==> Cron-бэкапы"
  ( crontab -l 2>/dev/null; cat "$APP_DIR/deploy/backup.cron" ) | crontab -
fi

echo ""
echo "✅ Готово: https://$DOMAIN"
echo "   Логи:       sudo -u $RUN_USER -H pm2 logs stroysearch"
echo "   Статус:     sudo -u $RUN_USER -H pm2 status"
echo "   Загрузки:   $UPLOADS_DIR"
echo "   Бэкапы:     $BACKUP_DIR (cron ежедневно 03:00)"
echo "   Обновление: sudo bash $APP_DIR/deploy/deploy.sh"
