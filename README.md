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
| `backup` | Daily `pg_dump` to Oracle Cloud Object Storage, kept 7 days. No ports. See [Backups](#backups) |
| `scheduler` | Runs Laravel's scheduler (`php artisan schedule:work`) so daily maintenance jobs (including user-data purge) actually execute |

On the server (repo cloned to `/opt/IT-Project-management`):

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
dc exec backup backup now               # extra backup to Oracle right away (see Backups)
```

Never add a `ports:` entry to `db`. Docker-published ports bypass `ufw`, so the Azure firewall (NSG) and the missing port are what keep the database private.

### Backups

The `backup` container runs `pg_dump` every day at 02:00 UTC (`BACKUP_AT` in `.env.production` to change it) and uploads the dump to the Oracle Cloud Object Storage bucket `db-backups`, so it's off the VM's disk. A lifecycle rule on the bucket deletes each backup after 7 days. Versioning is on to keep an older version if someone writes the same object name again. Storage is within Oracle's Always Free tier (20 GB; a dump is well under 1 MB today).

The server's URL (`BACKUP_UPLOAD_URL`, a pre-authenticated request) can only **write** backups. It can't list, read or delete them, and the bucket is private (`NoPublicAccess`). Reading them goes through the OCI CLI (Cloud Shell in the Oracle console).

What is **not** in the backup:
- **`APP_KEY`.** Message bodies are encrypted with it. A restored database without the original key has unreadable messages. Keep a copy of `.env.production` in the team's password manager.
- **Uploaded files** (the `app-storage` volume: avatars, post images, attachments).

#### Setup (once)

1. In the Oracle Cloud console, open **Cloud Shell** (the `>_` icon, top right). The OCI CLI there is already logged in.
2. Get the script into Cloud Shell: Cloud Shell menu (gear icon) → **Upload** → `deploy/backup-storage.sh`, or `git clone` the repo.
3. Run it:
   ```bash
   bash backup-storage.sh setup
   ```
   It creates the bucket, a policy that lets Object Storage delete old backups, the 7-day delete rule and the write-only URL. At the end it prints a `BACKUP_UPLOAD_URL=https://...` line.
4. On the server, add that line to `.env.production` (replace the empty `BACKUP_UPLOAD_URL=` line if there is one), then:
   ```bash
   deploy/deploy.sh                        # starts the backup container
   dc exec backup backup now               # first backup, don't wait for 02:00
   dc ps backup                            # should say (healthy)
   ```
5. In Cloud Shell, check it arrived: `bash backup-storage.sh list`.

The URL expires after a year. Running `setup` again makes a new one, and the old one stops working. Put a reminder in the calendar.

#### Checking

`dc ps backup` shows `unhealthy` when no backup succeeded in the last 26 hours or the last one failed (3 attempts, 10 minutes apart). `dc logs backup` says why. `deploy.sh` warns on every deploy if `BACKUP_UPLOAD_URL` is missing. In the console, the bucket is under Storage → Buckets → `db-backups`.

#### Test restore

Do this after setup and whenever the backup setup changes. It doesn't touch the live database.

1. In Cloud Shell, get a download link for the newest backup (valid 1 hour):
   ```bash
   bash backup-storage.sh url                    # or: bash backup-storage.sh url app-20261107T020000Z-1a2b3c4d.dump
   ```
2. On the server, restore it into a temporary database named `restore_test_<timestamp>`:
   ```bash
   deploy/restore-db.sh 'https://objectstorage.<region>.oraclecloud.com/p/.../o/app-...dump'
   ```
   The script checks the file is a valid dump, restores it as the `app` user in a single transaction, and prints row counts per table next to the live database's, plus the newest migration in each. Then it drops the temporary restore database, so no extra copy of personal data stays around.
3. Counts close to live (live has changed since the backup) and the same latest migration mean the backup is good. Add a row below.

| Date | Who | Backup | Where | Result |
|------|-----|--------|-------|--------|
| 2026-11-07 | Kan6de | `app-20261107T081800Z-1a2b3c4d.dump` | Local copy of the prod stack, storage emulated (not Oracle) | OK: 25 users / 50 posts / 10 categories restored, latest migration matched. Live restore (`--live`) also tested |

#### Restoring after a failure

1. If the VM is gone: set up a new one, clone the repo to `/opt/IT-Project-management`, put the saved `.env.production` back (same `APP_KEY`, same `BACKUP_UPLOAD_URL`) and run `deploy/deploy.sh`.
2. Get a download link as in step 1 above. Pick an older backup with `list` if the newest is already broken.
3. On the server:
   ```bash
   deploy/restore-db.sh --live '<url>'
   ```
   It restores into a new database first, so the live data is only touched once that worked. After you type the database name to confirm, it stops the backend, renames the current database to `app_before_restore_<time>`, puts the restored one in its place, runs any newer migrations and starts everything again. Drop the old database with the command it prints once the site looks right.

Anything written after the backup was made (at most a day) is lost.

#### Retention and account deletion

A backup is deleted 7–8 days after it was made (the lifecycle rule runs about once a day). A permanently deleted account therefore stays in backups for up to 8 days after the hard delete. To keep the 30-day limit for deleted accounts (AC-17), users are soft-deleted first and the scheduled `model:prune` task (run by the `scheduler` container) hard-deletes soft-deleted users after 22 days.
