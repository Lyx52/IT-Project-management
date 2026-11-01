#!/bin/sh
set -e
cd /var/www/frontend

# Bootstrap Angular into the bind-mounted folder on first run
if [ ! -f package.json ]; then
  echo ">> Creating Angular project..."
  (cd /tmp && ng new frontend --routing --style=scss --skip-git --skip-install --ssr=false --defaults)
  cp -R /tmp/frontend/. /var/www/frontend/
  rm -rf /tmp/frontend
fi

[ -d node_modules ] || npm install

exec "$@"
