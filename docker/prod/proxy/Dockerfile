# Public entry point: terminates HTTPS (automatic Let's Encrypt), serves the
# built Angular app and forwards API requests to the backend.
# Build context is the repo root.

FROM node:22-bookworm-slim AS build
ENV NG_CLI_ANALYTICS=false
WORKDIR /src
COPY project/frontend/package.json project/frontend/package-lock.json ./
RUN npm ci
COPY project/frontend/ ./
RUN npx ng build --configuration production

FROM caddy:2-alpine
COPY docker/prod/proxy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/dist/frontend/browser /srv
