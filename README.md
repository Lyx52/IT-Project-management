# IT Project Management

Laravel (API) + Angular (SPA) + PostgreSQL, run with Docker. All code lives in `project/` and is bind-mounted into the containers, so host edits apply immediately.

```
project/
  backend/    Laravel
  frontend/   Angular
docker/       Dockerfiles + entrypoints
```

## Start

```bash
mkdir -p project/backend project/frontend   # must be created as your user, not by Docker
cp .env.example .env                         # optional, defaults work
docker compose up --build
```

First run scaffolds Laravel into `project/backend` and Angular into `project/frontend`, installs dependencies and runs migrations (a few minutes). Later runs start fast.

| Service  | URL / port                                              |
|----------|---------------------------------------------------------|
| Angular  | http://localhost:4200                                   |
| Laravel  | http://localhost:8001                                   |
| Postgres | localhost:5432 (db / user / pass: `app` / `app` / `secret`) |

Inside Docker the backend reaches Postgres at host `db`.

## Common commands

```bash
docker compose exec backend php artisan <cmd>
docker compose exec backend composer require <pkg>
docker compose exec frontend ng generate component <name>
docker compose exec frontend npm install <pkg>
docker compose exec db psql -U app app
```

Run from WSL/Linux so file ownership matches (`UID`/`GID` in `.env`, default 1000).
