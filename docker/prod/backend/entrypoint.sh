#!/bin/sh
set -e
cd /app

# The storage volume is created from the image once; later images may need
# folders that aren't in it yet
mkdir -p storage/app/public storage/app/private storage/framework/cache/data \
  storage/framework/sessions storage/framework/views storage/logs

# Cache config/routes/views using the real environment of this container
php artisan optimize

exec "$@"
