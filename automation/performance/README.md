# Performance benchmark (PB-53)

This repeatable benchmark seeds 10,000 realistic posts, measures the public search API, and measures the Home, Items, and Map pages in headless Chrome under a simulated 4G connection.

## Requirements

- Docker Compose `db` is running and healthy; migrations have completed.
- The development backend has its `.env` and `APP_KEY` configured.
- .NET 10 SDK and Google Chrome are installed on the machine running the script.

## Run from PowerShell at the repository root

```powershell
docker compose up -d db backend
$env:PERFORMANCE_APP_KEY = (docker compose exec -T backend php artisan key:generate --show).Trim()
docker compose -f docker-compose.yml -f docker-compose.performance.yml up -d --build backend-performance frontend-performance
```

The `frontend-performance` service builds Angular in production mode and serves the static bundle through Caddy with gzip. It also proxies API requests to `backend-performance`. Do not use `ng serve` for this benchmark; that development server sends larger, uncompressed assets.

In another PowerShell window:

```powershell
$keyLine = docker inspect itpm-backend-performance --format '{{range .Config.Env}}{{println .}}{{end}}' | Select-String '^APP_KEY='
$env:PERFORMANCE_APP_KEY = $keyLine.Line.Substring(8)
$env:PERFORMANCE_API_URL = 'http://localhost:8002'
$env:PERFORMANCE_FRONTEND_URL = 'http://localhost:4201'
.\automation\performance\run-performance.ps1
```

The script refreshes only posts belonging to `performance-dataset@findit.test`; it does not reset the database or touch other users' posts. It then runs five warm search measurements and five cold page loads per route. Browser cache is disabled for page measurements. The reported value is the median; search must be under 2 seconds and each page under 2.5 seconds.

Results are saved in `automation/performance/TestResults/performance-results.json` and `automation/performance/TestResults/performance.trx`. Git ignores these generated artifacts. The NUnit output also records each sample and median.

The performance backend uses the production Dockerfile, optimized Composer autoloading and OPcache, and does not mount PHP source from Windows. It reuses the local Compose PostgreSQL database. The seeder only replaces the dedicated performance account's posts.

When finished, stop the extra performance services:

```powershell
docker compose -f docker-compose.yml -f docker-compose.performance.yml stop backend-performance frontend-performance
docker compose -f docker-compose.yml -f docker-compose.performance.yml rm -f backend-performance frontend-performance
```

To target different local URLs, set `PERFORMANCE_API_URL` and/or `PERFORMANCE_FRONTEND_URL` before running the script.
