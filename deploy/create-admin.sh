#!/usr/bin/env bash
# Creates the initial admin account in production. Run it once, by hand, in
# a shell on the server, after the first deploy. Further admins are managed
# from the website, so this refuses to run while an active admin exists.
#
# Usage: deploy/create-admin.sh <username> <email>
#
# The password is asked at a hidden prompt (at least 12 characters).
#
# On purpose this only works for a person at a terminal on the server:
#   - no TTY (CI job, cron, piped input, `ssh host cmd` without -t) -> refused
#   - Docker pointed at a remote daemon (DOCKER_HOST, docker context)  -> refused
# The site itself has no way to call it: there is no route for it, and the
# Laravel command also refuses to run outside an interactive CLI.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -ne 2 ]; then
  echo "usage: $0 <username> <email>" >&2
  exit 1
fi

if ! [ -t 0 ] || ! [ -t 1 ]; then
  echo "Refusing to run without an interactive terminal. Run it by hand on the server." >&2
  exit 1
fi

# Must talk to this machine's Docker, not drive the server from elsewhere
docker_host="${DOCKER_HOST:-$(docker context inspect --format '{{.Endpoints.docker.Host}}' 2>/dev/null || true)}"
case "$docker_host" in
  unix://*) ;;
  *)
    echo "Refusing to run: Docker points at '${docker_host:-unknown}', not the local socket." >&2
    echo "Run this script in a shell on the server itself." >&2
    exit 1
    ;;
esac

if [ ! -f .env.production ]; then
  echo ".env.production missing, run deploy/init-env.sh first" >&2
  exit 1
fi

compose() { docker compose --env-file .env.production -f docker-compose.prod.yml "$@"; }

if [ -z "$(compose ps --status running -q backend)" ]; then
  echo "backend container is not running, run deploy/deploy.sh first" >&2
  exit 1
fi

compose exec backend php artisan app:create-first-admin --username "$1" --email "$2"
