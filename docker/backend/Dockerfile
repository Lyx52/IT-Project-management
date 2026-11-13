FROM php:8.4-cli-bookworm

ARG UID=1000
ARG GID=1000

RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip zip libpq-dev libzip-dev libicu-dev libonig-dev libpng-dev libjpeg-dev libwebp-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install exif gd pdo_pgsql pgsql zip intl bcmath mbstring pcntl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

RUN groupadd -g ${GID} dev 2>/dev/null || true \
    && useradd -m -u ${UID} -g ${GID} dev 2>/dev/null || true \
    && mkdir -p /var/www/backend && chown ${UID}:${GID} /var/www/backend

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER ${UID}:${GID}
WORKDIR /var/www/backend
EXPOSE 8000
ENTRYPOINT ["entrypoint.sh"]
CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
