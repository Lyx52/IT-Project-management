#!/usr/bin/env bash
# Run once on the server. Creates .env.production with random secrets.
# Usage: deploy/init-env.sh <hostname> <email for Let's Encrypt>
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -ne 2 ]; then
  echo "usage: $0 <hostname> <letsencrypt-email>" >&2
  exit 1
fi
if [ -e .env.production ]; then
  echo ".env.production already exists, not overwriting it" >&2
  exit 1
fi

umask 077
cat > .env.production <<EOF
# Production settings, read by deploy/deploy.sh. Never commit this file.
SITE_ADDRESS=$1
ACME_EMAIL=$2
APP_NAME="Lost and Found"
APP_KEY=base64:$(openssl rand -base64 32)

DB_DATABASE=app
DB_USERNAME=app
DB_PASSWORD=$(openssl rand -hex 24)
DB_ROOT_PASSWORD=$(openssl rand -hex 24)

MAIL_MAILER=log

# Daily database backups (see Backups in README.md). Paste the BACKUP_UPLOAD_URL
# line printed by deploy/backup-storage.sh setup here.
BACKUP_UPLOAD_URL=
EOF

echo "Wrote .env.production for https://$1"
