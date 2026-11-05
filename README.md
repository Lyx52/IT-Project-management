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
| pgAdmin  | http://localhost:5050 (optional, see below)             |

Inside Docker the backend reaches Postgres at host `db`.

Postgres only listens on `127.0.0.1`, so other machines on your network can't reach it. Laravel connects as `app`, which can only use its own database (no superuser rights). The superuser is `postgres` (password `DB_ROOT_PASSWORD`), for admin tasks only. `docker/db/initdb` creates the `app` user and database the first time the DB volume is created.

## Common commands

```bash
docker compose exec backend php artisan <cmd>
docker compose exec backend composer require <pkg>
docker compose exec frontend ng generate component <name>
docker compose exec frontend npm install <pkg>
docker compose exec db psql -U app app
docker compose --profile tools up -d                # pgAdmin, log in as admin@example.com / admin, add server host "db"
docker compose exec db pg_dump -U app app > backup.sql
```

Run from WSL/Linux so file ownership matches (`UID`/`GID` in `.env`, default 1000).

## Database

The Lost & Found schema is built with Laravel migrations in `project/backend/database/migrations`. They run automatically when the backend container starts. The ER diagram is in `project/backend/database/diagram/` (`.puml` source + `.png`).

| Table | Purpose |
|-------|---------|
| `users` | `username`, `email` (unique, case-insensitive), `role` (`user`/`admin`), `banned_at`, GDPR consent (`terms_accepted_at`, `privacy_policy_version`), `avatar_path`, soft deletes |
| `password_reset_tokens`, `sessions` | Laravel defaults |
| `personal_access_tokens` | Sanctum API tokens |
| `categories` | Item categories, 10 defaults inserted by the migration |
| `posts` | Lost/found posts: `type` (`lost`/`found`), `status` (`pending`/`approved`/`rejected`/`resolved`), coordinates, `event_date` |
| `post_images` | Images attached to a post |
| `messages` | Direct messages between users, optionally about a post. Text and/or attachments |
| `message_attachments` | Files attached to a message (any number): `path`, `mime_type` (`image/*` or `video/*`), `size` in bytes |
| `notifications` | Laravel database notifications |
| `reports` | Users reporting posts. One report per user per post, `status` `open`/`closed` |

Rules the database enforces (inserts that break them fail):
- Permanently deleting a user (not soft delete) deletes their posts, images and messages. Reports they made or reviewed are kept, with the user set to `NULL`.
- A category that is still used by posts can't be deleted.
- `type`, `status`, `role` and `mime_type` only accept the values listed above.
- Coordinates must be valid lat/lng.
- A message can't be sent to yourself. Deleting a message deletes its attachments.

### After pulling these changes

The DB user setup and the `users` table changed, so delete your local database volume once and rebuild it:

```bash
docker compose down -v      # deletes local DB data
docker compose up -d
docker compose exec backend php artisan db:seed
```

The seeder creates `testuser` / `test@example.com` (password `password`). `User::factory()->admin()` creates an admin.

### Notes for backend

- `App\Models\User` still lists `name` as fillable. It needs to be updated to `username`, `role`, `terms_accepted_at` and `privacy_policy_version`. There is no `name` or `remember_token` column any more.
- When installing Sanctum (`php artisan install:api`), delete the `personal_access_tokens` migration it publishes. The table already exists here.
- Encrypt `messages.body` with the `encrypted` cast in the model.
- The database can't check "a message needs a body or at least one attachment" (it spans two tables), so the message FormRequest must. Create the message and its attachments in one transaction.
- Set `message_attachments.mime_type` from the stored file (`$file->getMimeType()`, which reads the content), not from the client's `Content-Type` header.
- Deleting a message row doesn't remove its files from disk. Delete them in the model's `deleting` event or in the prune job.
- Schema changes go through new migrations.

## Production (Azure VM)

`docker-compose.prod.yml` runs the live site. It's separate from the dev setup above, which stays unchanged.

| Container | Role |
|-----------|------|
| `proxy` | Caddy. The only container with public ports (80, 443). Gets and renews the Let's Encrypt certificate, redirects HTTP to HTTPS, serves the built Angular app and forwards `/api`, `/sanctum`, `/storage` and `/up` to the backend |
| `backend` | Laravel on FrankenPHP, plain HTTP on port 8080, reachable only from the proxy |
| `db` | Postgres on an internal Docker network with no published port and no internet access |

On the server (repo cloned to `~/IT-Project-management`):

```bash
deploy/init-env.sh <hostname> <email>   # once: writes .env.production with random secrets
deploy/deploy.sh                        # every deploy: pull, build, migrate, restart
```

`deploy.sh` runs `php artisan migrate --force` before switching to the new containers. If a migration fails, the deploy stops and the old version keeps running. Pushes to `main` deploy automatically through `.github/workflows/deploy.yml` once the repository variable `DEPLOY_ENABLED` is `true` and the `DEPLOY_*` secrets are set.

Useful commands on the server:

```bash
alias dc='docker compose --env-file .env.production -f docker-compose.prod.yml'
dc ps                                   # db must show no host port
dc logs -f backend
dc exec backend php artisan migrate:status
dc exec db psql -U app app              # DB access only from the server itself
dc exec db pg_dump -U app app > backup-$(date +%F).sql
```

Never add a `ports:` entry to `db`. Docker-published ports bypass `ufw`, so the Azure firewall (NSG) and the missing port are what keep the database private.
