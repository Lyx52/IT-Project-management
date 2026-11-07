#!/usr/bin/env bash
# Pulls the latest main, rebuilds, runs migrations and restarts production.
# Run on the server from anywhere: /opt/IT-Project-management/deploy/deploy.sh

# Wrapped in a function so bash reads the whole script before git pull
# replaces this file
main() {
  set -euo pipefail
  cd "$(dirname "$0")/.."

  if [ ! -f .env.production ]; then
    echo ".env.production missing, run deploy/init-env.sh first" >&2
    exit 1
  fi

  compose() { docker compose --env-file .env.production -f docker-compose.prod.yml "$@"; }

  echo ">> Pulling latest code"
  git pull --ff-only

  echo ">> Building images"
  compose build --pull

  echo ">> Running migrations"
  compose up -d db
  # Exits non-zero on a failed migration, which stops the deploy here and
  # leaves the previous containers running
  compose run --rm backend php artisan migrate --force

  echo ">> Starting containers"
  compose up -d --remove-orphans

  echo ">> Checking backend health"
  for _ in $(seq 1 20); do
    if compose exec -T proxy wget -qO /dev/null http://backend:8080/up; then
      docker image prune -f >/dev/null
      echo ">> Deployed: https://$(grep '^SITE_ADDRESS=' .env.production | cut -d= -f2)"
      if ! grep -Eq '^BACKUP_UPLOAD_URL=.+' .env.production; then
        echo "!! BACKUP_UPLOAD_URL is not set in .env.production, database backups are NOT running. See Backups in README.md" >&2
      fi
      return 0
    fi
    sleep 3
  done
  echo "Backend did not become healthy, check: docker compose -f docker-compose.prod.yml logs backend" >&2
  exit 1
}

main "$@"
