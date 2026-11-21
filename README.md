# FindIT

A lost & found platform. People post items they lost or found, search and browse them on a list or a map, and message each other about a post. Admins moderate posts, manage categories and ban users.

Laravel API + Angular SPA + PostgreSQL, run with Docker in development and production.

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Local development](#local-development)
- [Tests and CI](#tests-and-ci)
- [API](#api)
- [Database](#database)
- [Registration](#registration)
- [Data retention](#data-retention)
- [Production](#production) (full guide: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md))
- [Backups](#backups)
- [Performance benchmark](#performance-benchmark)
- [Backend conventions](#backend-conventions)

## Features

- **Posts.** Lost or found items with a category, description, location on a map, event date and photos (EXIF data is stripped). New posts wait for admin approval before they appear publicly. Authors can edit, resolve and delete their own posts.
- **Search.** Accent- and case-insensitive text search over titles and descriptions, filters by type and category, a list view and a Leaflet map view.
- **Suggested matches.** The author of a post sees likely counterparts: approved posts of the opposite type in the same category, less than 2 km away, with an event date within 7 days.
- **Saved searches.** Users save a search and get a notification when a new post matches it.
- **Messages.** Direct messages about a post, with image and video attachments. Message bodies are encrypted at rest. Attachments are served through signed, expiring links.
- **Notifications.** A bell in the header for saved-search matches and moderation results (post approved or rejected).
- **Moderation.** Users report posts. Admins approve or reject posts (with a reason), ban and unban users, manage categories and see site statistics.
- **Accounts.** Registration with a CAPTCHA, token-based login, data export, account deletion with automatic purge after 21 days.

## Tech stack

| Layer | Technology |
|-------|------------|
| Backend | PHP 8.4, Laravel 13, Sanctum (bearer tokens), Scramble (OpenAPI docs) |
| Frontend | Angular 22, Bootstrap 5, Leaflet, Vitest |
| Database | PostgreSQL 17 |
| Production | Azure VM, Caddy (HTTPS, static files), FrankenPHP, Oracle Cloud Object Storage for backups |
| CI/CD | GitHub Actions |
| Performance tests | .NET 10, headless Chrome |

## Repository layout

```
project/
  backend/              Laravel API (API.md documents every endpoint)
  frontend/             Angular SPA
docker/
  backend/, frontend/   Dev images and entrypoints
  db/initdb/            Creates the app database user on first start
  prod/                 Production images: backend, proxy, backup
  performance/          Static frontend build for the benchmark
deploy/                 Server scripts: deploy, first admin, backups, restore
automation/             Performance benchmark (.NET + PowerShell)
.github/workflows/      CI and deploy
docker-compose.yml               Development
docker-compose.prod.yml          Production
docker-compose.performance.yml   Benchmark stack
```

## Local development

### Requirements

Docker with Compose. On Windows, run everything from WSL so file ownership matches your user (`UID`/`GID` in `.env`, default 1000).

### Start

```bash
cp .env.example .env          # optional, the defaults work
docker compose up --build
docker compose exec backend php artisan db:seed
```

The code in `project/` is bind-mounted into the containers, so edits on the host apply immediately. The backend container installs Composer packages, creates `.env` and `APP_KEY` if missing and runs migrations every time it starts. The frontend container runs `npm install` if `node_modules` is missing.

| Service | Address |
|---------|---------|
| Angular | http://localhost:4200 |
| Laravel API | http://localhost:8001/api/v1 |
| API docs (Scramble) | http://localhost:8001/docs/api |
| Postgres | `localhost:5432`, database `app`, user `app`, password `secret` |
| pgAdmin (optional) | http://localhost:5050 |

The seeder creates two accounts, both with the password `password`:

| Username | E-mail | Role |
|----------|--------|------|
| `testuser` | `test@example.com` | user |
| `admin` | `admin@example.com` | admin |

### Database access

Postgres listens on `127.0.0.1` only, so other machines on your network can't reach it. Inside Docker the backend reaches it at host `db`.

Laravel connects as `app`, which can only use its own database and has no superuser rights. The superuser `postgres` (password `DB_ROOT_PASSWORD`) is for admin tasks only. `docker/db/initdb` creates the `app` user and database the first time the database volume is created. If you change those settings later, recreate the volume:

```bash
docker compose down -v      # deletes all local DB data
docker compose up -d
docker compose exec backend php artisan db:seed
```

### Common commands

```bash
docker compose exec backend php artisan <command>
docker compose exec backend composer require <package>
docker compose exec frontend npx ng generate component <name>
docker compose exec frontend npm install <package>
docker compose exec db psql -U app app
docker compose exec db pg_dump -U app app > backup.sql
docker compose --profile tools up -d     # pgAdmin: log in as admin@example.com / admin, add server host "db"
```

### E-mail in development

Mail goes to the Laravel log by default (`MAIL_MAILER=log`). To send real mail, set `MAIL_MAILER=resend`, `RESEND_API_KEY` and a `MAIL_FROM_ADDRESS` on a domain verified in Resend in `.env`.

## Tests and CI

```bash
docker compose exec backend php artisan test        # backend tests (in-memory SQLite)
docker compose exec backend vendor/bin/pint         # fix PHP code style
docker compose exec frontend npx ng test --watch=false
docker compose exec frontend npx prettier --write src
```

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

| Job | What it checks |
|-----|----------------|
| Backend | Pint style check, migrations against Postgres 17, `php artisan test`, migration rollback |
| Frontend | Prettier check, unit tests, production build |
| Docker image | Builds the production `backend`, `proxy` and `backup` images |

CI runs the backend tests against Postgres, not SQLite, so a migration that only works on SQLite fails there. Mark these jobs as required status checks on `main` so a failing PR can't be merged.

## API

All endpoints live under `/api/v1`. Authentication uses Sanctum bearer tokens from `POST /login`.

- [`project/backend/API.md`](project/backend/API.md) documents every endpoint: fields, responses, errors and rate limits.
- Scramble generates interactive docs at `/docs/api` and the OpenAPI document at `/docs/api.json`.

## Database

The schema is built with Laravel migrations in [`project/backend/database/migrations`](project/backend/database/migrations). Schema changes always go through a new migration. The ER diagram is in [`project/backend/database/diagram/`](project/backend/database/diagram/) (`.puml` source and `.png`).

| Table | Purpose |
|-------|---------|
| `users` | `username`, `email` (unique, case-insensitive), `role` (`user`/`admin`), `banned_at`, GDPR consent (`terms_accepted_at`, `privacy_policy_version`), `avatar_path`, soft deletes |
| `categories` | Item categories. 10 defaults are inserted by the migration. Retired categories (`retired_at`) can't be picked for new posts |
| `posts` | `type` (`lost`/`found`), `status` (`pending`/`approved`/`rejected`/`resolved`), coordinates, `event_date`, moderation fields (`reviewed_by`, `reviewed_at`, `rejection_reason`) |
| `post_images` | Images attached to a post |
| `messages` | Direct messages between users about a post. Text, attachments or both. The body is encrypted |
| `message_attachments` | Files attached to a message: `path`, `mime_type` (`image/*` or `video/*`), `size` in bytes |
| `saved_searches`, `saved_search_matches` | A user's saved search filters and the posts already notified for each |
| `reports` | Users reporting posts. One report per user per post, `status` `open`/`closed` |
| `notifications` | Laravel database notifications |
| `personal_access_tokens` | Sanctum API tokens |
| `cache`, `jobs`, `sessions`, `password_reset_tokens` | Laravel defaults |

The database enforces these rules, so inserts that break them fail:

- Permanently deleting a user (not a soft delete) deletes their posts, images, messages and saved searches. Reports they made or reviewed are kept, with the user set to `NULL`.
- A category that is still used by posts can't be deleted. Retire it instead.
- `type`, `status`, `role` and `mime_type` only accept the values listed above.
- Coordinates must be valid latitude and longitude.
- A user can't send a message to themselves. Deleting a message deletes its attachments.

## Registration

### E-mail verification (off)

The project has no mail domain yet, so e-mail verification is **off**. New accounts get no verification e-mail and can sign in and post right away.

The verification code is still in place. To turn it on, set `EMAIL_VERIFICATION_ENABLED=true` (`.env` in development, `.env.production` on the server followed by `deploy/deploy.sh`). Mail has to work first, see [E-mail in development](#e-mail-in-development).

While it is off, `email_verified_at` stays `null`, so nobody is marked as verified who wasn't. Once it is turned on, accounts created in the meantime are asked to verify before posting, and the header prompt has a "Resend e-mail" button for that. Clients decide whether to show the prompt from `must_verify_email` in the user payload, not from `email_verified_at`. Details are in [`config/verification.php`](project/backend/config/verification.php).

### Sign-up CAPTCHA

Sign-up is protected by a self-hosted CAPTCHA, with no external service. `CAPTCHA_TYPE` picks one of three kinds:

| `CAPTCHA_TYPE` | The user sees | Answer |
|---|---|---|
| `hash` (default) | "Checking your browser…" with a progress bar | Found by the browser, nothing to type |
| `math` | "What is 7 + 5?" | Typed in, never negative |
| `determinant` | A 2×2 matrix | `a·d − b·c`, typed in, can be negative |

Set `CAPTCHA_TYPE` in `project/backend/.env` for development, or in `.env.production` on the server followed by `deploy/deploy.sh` (production caches its config at start-up). The frontend needs no change: the register page shows whatever kind the server sends. An unknown value makes `GET /captcha` fail with a clear error instead of silently picking a type.

How it works for every type:

1. `GET /api/v1/captcha` returns `captcha_id`, `type`, `expires_in` and the challenge: `question` (math), `question` and `matrix` (determinant), or `algorithm`, `salt`, `challenge` and `max_number` (hash). The answer stays in the server's cache and is never sent to the browser.
2. `POST /api/v1/register` sends `captcha_id` and `captcha_answer` with the other fields. The `captcha` middleware checks them first, so without a solved CAPTCHA the endpoint doesn't reveal whether an e-mail address or username is taken.
3. Each challenge allows **one** attempt, right or wrong, and expires after 5 minutes (`CAPTCHA_TTL_SECONDS`). After any failed registration the form fetches a new one.

**The hash puzzle.** `challenge` is `SHA-256(salt + n)` for a secret whole number `n` between 0 and `max_number`. The register page starts solving as soon as it opens: a Web Worker tries `n = 0, 1, 2, …` until the hash matches, so the form stays responsive and the puzzle is usually solved before the user finishes typing. If the user clicks "Create account" first, the form is sent once the puzzle is solved. The work is bounded at `max_number + 1` hashes, half that on average. The default of 3,000,000 (`CAPTCHA_MAX_NUMBER`) takes about 1 second at worst on a current laptop and 10–30 seconds on a slow phone. If you change it, keep the slow-phone worst case under a minute. Other settings are in [`config/captcha.php`](project/backend/config/captcha.php).

`GET /captcha` is limited to 30 requests per minute per IP and `POST /register` to 5. Unanswered challenges are removed from the `cache` table by the daily `app:prune-expired-cache` job.

None of the three types stops a bot written for this site. `math` and `determinant` can be read by a program as easily as by a person. `hash` doesn't tell a person from a program either, but it makes every sign-up cost CPU time, which, together with the rate limits, makes mass registration slow and expensive.

## Data retention

Account deletion immediately suspends the account. The account and its related personal data are permanently deleted after 30 days. Daily pruning and the 7-day backup lifecycle mean the final backup containing that data can remain for up to 39 days after the request.

The scheduler also removes resolved posts six months after their `resolved_at` date and read notifications 90 days after their `read_at` date. Unread notifications are retained.

Account retention settings live in [`project/backend/config/retention.php`](project/backend/config/retention.php):

| Setting | Default | Change it with |
|---------|---------|----------------|
| `account_purge_days` | 30 | `ACCOUNT_PURGE_DAYS=` in `.env.production`, then `deploy/deploy.sh` |
| `backup_retention_days` | 7 | `RETENTION_DAYS` in `deploy/backup-storage.sh` and rerun `setup`. Change both |
| `deleted_account_limit_days` | 39 | 30-day suspension plus daily cleanup and backup lifecycle |

### Scheduled jobs

Defined in [`routes/console.php`](project/backend/routes/console.php) and run by the `scheduler` container in production. All times are UTC.

| Time | Job |
|------|-----|
| 00:00 | `model:prune`: permanently deletes accounts past `account_purge_days` |
| 00:30 | `app:prune-expired-cache`: removes expired cache entries, including unanswered CAPTCHAs |
| 00:45 | `sanctum:prune-expired`: removes API tokens that expired more than a day ago |
| 01:00 | `app:prune-old-platform-data`: removes expired resolved posts and read notifications; appends run counts to `storage/logs/platform-data-pruning.log` |
| 02:00 | Database backup (in the `backup` container, see [Backups](#backups)) |

## Production

The live site runs on an Azure VM from `docker-compose.prod.yml`, separate from the development setup. **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** covers installing a new server, configuration, migrations, backups, redeploying, rollback and moving to a new server.

| Container | Role |
|-----------|------|
| `proxy` | Caddy. The only container with public ports (80, 443). HTTPS via Let's Encrypt, passes every request through `anubis`, serves the built Angular app, forwards `/api/*`, `/storage/*` and `/up` to the backend |
| `anubis` | [Anubis](https://github.com/TecharoHQ/anubis) bot filter: browsers solve a few-second proof-of-work once, known AI scrapers are refused. See "Bot protection" in the deployment guide |
| `backend` | Laravel on FrankenPHP, reachable only from the proxy |
| `scheduler` | Laravel's scheduled jobs. Same image as `backend` |
| `db` | Postgres on an internal network with no published port and no internet access |
| `backup` | Daily `pg_dump` to Oracle Cloud Object Storage, kept 7 days |

In short:

```bash
deploy/init-env.sh <hostname> <email>   # once: writes .env.production with random secrets
deploy/deploy.sh                        # every deploy: pull, build, migrate, restart
deploy/create-admin.sh <user> <email>   # once, after the first deploy: initial admin
```

Pushes to `main` deploy automatically through `.github/workflows/deploy.yml` once it is set up. `deploy.sh` runs migrations before replacing the running containers, so a failed migration leaves the old version running.

## Backups

The database is backed up daily to a private Oracle Cloud bucket and kept for 7 days. The server can only write backups, not read or delete them. Uploaded files and `APP_KEY` are **not** in the backup; keep `.env.production` in the team's password manager.

Setup, monitoring, test restores (with the restore log) and disaster recovery are in [DEPLOYMENT_GUIDE.md, section 7](DEPLOYMENT_GUIDE.md#7-backups).

## Performance benchmark

`automation/` contains a repeatable benchmark: it seeds 10,000 posts, measures the public search API, and loads the Home, Items and Map pages in headless Chrome over a simulated 4G connection. It runs against `docker-compose.performance.yml`, which uses the production backend image and a production Angular build served by Caddy.

Requirements: the dev `db` and `backend` containers running, the .NET 10 SDK and Google Chrome. Steps are in [`automation/performance/README.md`](automation/performance/README.md).

## Backend conventions

- **Never make `role` or `banned_at` mass assignable.** Otherwise anyone could register with `"role": "admin"`. Set them explicitly in admin-only code (`$user->forceFill(['role' => 'admin'])`). A test fails if `role` becomes fillable.
- **Set `mime_type` from the stored file** (`$file->getMimeType()`, which reads the content), never from the client's `Content-Type` header.
- **Validate across tables in the FormRequest.** The database can't check that a message has a body or at least one attachment, so `StoreMessageRequest` does. Create a message and its attachments in one transaction.
- **Deleting rows doesn't delete files.** Account purges remove a user's files from disk. Any new code that deletes posts, images or attachments has to remove their files too.
- **Use `User::factory()->admin()`** to create an admin in tests.
- **Schema changes go through new migrations.** Never edit a migration that has already run in production.
