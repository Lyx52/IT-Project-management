# Laravel on FrankenPHP, plain HTTP on :8080, only reachable from the proxy.
# Build context is the repo root.

FROM dunglas/frankenphp:1-php8.4-bookworm

RUN install-php-extensions gd exif pdo_pgsql pgsql intl zip bcmath pcntl opcache \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY docker/prod/backend/php.ini "$PHP_INI_DIR/conf.d/zz-app.ini"
COPY docker/prod/backend/Caddyfile /etc/frankenphp/Caddyfile
COPY docker/prod/backend/entrypoint.sh /usr/local/bin/app-entrypoint
RUN chmod +x /usr/local/bin/app-entrypoint

WORKDIR /app

# Dependencies first so they're cached when only app code changes
COPY project/backend/composer.json project/backend/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY project/backend/ ./
RUN composer dump-autoload --optimize --no-dev \
    && php artisan storage:link \
    && chown -R www-data:www-data storage bootstrap/cache /data/caddy /config/caddy

USER www-data
EXPOSE 8080
ENTRYPOINT ["app-entrypoint"]
CMD ["frankenphp", "run", "--config", "/etc/frankenphp/Caddyfile"]
