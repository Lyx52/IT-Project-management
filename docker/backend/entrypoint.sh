#!/bin/sh
set -e
cd /var/www/backend

# Bootstrap Laravel into the bind-mounted folder on first run
if [ ! -f artisan ]; then
  echo ">> Creating Laravel project..."
  composer create-project laravel/laravel /tmp/laravel --prefer-dist --no-interaction
  cp -R /tmp/laravel/. /var/www/backend/
  rm -rf /tmp/laravel
fi

[ -d vendor ] || composer install --no-interaction
[ -f .env ] || cp .env.example .env

# Point Laravel at Postgres (values come from compose environment)
set_env() {
  if grep -q "^#\? \?$1=" .env; then
    sed -i "s|^#\? \?$1=.*|$1=$2|" .env
  else
    echo "$1=$2" >> .env
  fi
}
set_env DB_CONNECTION pgsql
set_env DB_HOST "${DB_HOST:-db}"
set_env DB_PORT "${DB_PORT:-5432}"
set_env DB_DATABASE "${DB_DATABASE:-app}"
set_env DB_USERNAME "${DB_USERNAME:-app}"
set_env DB_PASSWORD "${DB_PASSWORD:-secret}"
set_env APP_URL "${APP_URL:-http://localhost:8000}"
set_env FRONTEND_URL http://localhost:4200

grep -q '^APP_KEY=.\+' .env || php artisan key:generate --force
php artisan migrate --force

exec "$@"
