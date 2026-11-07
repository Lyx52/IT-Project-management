#!/usr/bin/env bash
# Creates the initial admin account in production. Run once on the server
# after the first deploy. Further admins are managed from the website, so this
# refuses to run while an active admin exists.
#
# Usage: deploy/create-admin.sh <username> <email>
#
# The password is asked at a hidden prompt (at least 12 characters). Run it
# without a terminal (e.g. piped or over ssh without -t) and a random password
# is generated and printed once instead.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -ne 2 ]; then
  echo "usage: $0 <username> <email>" >&2
  exit 1
fi
if [ ! -f .env.production ]; then
  echo ".env.production missing, run deploy/init-env.sh first" >&2
  exit 1
fi

compose() { docker compose --env-file .env.production -f docker-compose.prod.yml "$@"; }

if [ -z "$(compose ps --status running -q backend)" ]; then
  echo "backend container is not running, run deploy/deploy.sh first" >&2
  exit 1
fi

# Hidden password prompt needs a TTY. Without one, -T plus -n makes the
# command generate a password instead of waiting for input.
args=(exec)
if ! { [ -t 0 ] && [ -t 1 ]; }; then
  args+=(-T)
fi
args+=(backend php artisan app:create-first-admin --username "$1" --email "$2")
if ! { [ -t 0 ] && [ -t 1 ]; }; then
  args+=(--no-interaction)
fi

compose "${args[@]}"
