# FindIT backend

The Laravel 13 API for FindIT (PHP 8.4, PostgreSQL 17, Sanctum bearer tokens).

- **Endpoints:** [API.md](API.md) documents every endpoint. Scramble also serves interactive docs at http://localhost:8001/docs/api.
- **Setup, database, retention and conventions:** see the [main README](../../README.md).
- **Production:** see [DEPLOYMENT_GUIDE.md](../../DEPLOYMENT_GUIDE.md).

## Running

The API runs in the `backend` Docker container (see the main README) at http://localhost:8001/api/v1. On every start the container installs Composer packages, creates `.env` and `APP_KEY` if missing and runs migrations. Run commands inside it:

```bash
docker compose exec backend php artisan test          # tests (in-memory SQLite; CI also runs them on Postgres)
docker compose exec backend vendor/bin/pint           # fix code style (CI checks this)
docker compose exec backend php artisan db:seed       # categories and the two test accounts
docker compose exec backend php artisan migrate:status
```

## Where things are

| Path | Contents |
|------|----------|
| `routes/api.php` | All `/api/v1` routes, with their auth and rate-limit middleware |
| `routes/console.php` | Scheduled jobs (account purge, cache, token and old-data cleanup) |
| `app/Http/Controllers/Api/V1/` | Controllers; `Admin/` holds moderation, users, reports and statistics |
| `app/Http/Requests/` | Form request validation (posts, messages, search, categories, registration) |
| `app/Http/Resources/` | JSON response shapes |
| `app/Services/` | CAPTCHA, image and attachment handling, saved-search and possible-match notifiers |
| `app/Notifications/` | In-app (database) notifications and the verification e-mail |
| `config/captcha.php`, `config/verification.php`, `config/retention.php` | Project-specific settings |
| `database/migrations/` | The schema. Always add a new migration; never edit one that has run in production |
| `database/diagram/` | ER diagram (`.puml` and `.png`) |
