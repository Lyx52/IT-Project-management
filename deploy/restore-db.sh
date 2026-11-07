#!/usr/bin/env bash
# Restores a backup made by the backup container. Run on the server.
#
#   deploy/restore-db.sh <dump file or URL>
#       Test restore: loads the backup into a temporary database "restore_test",
#       compares row counts with the live database, then drops it again.
#       The live database is not touched.
#
#   deploy/restore-db.sh --live <dump file or URL>
#       Disaster recovery: loads the backup into a new database, then swaps it
#       in for the live one. The old database is kept for rollback.
#
# Get a download URL with deploy/backup-storage.sh url (valid 1 hour).
set -euo pipefail
cd "$(dirname "$0")/.."

compose() { docker compose --env-file .env.production -f docker-compose.prod.yml "$@"; }
env_value() { grep "^$1=" .env.production | cut -d= -f2- || true; }

live=false
if [ "${1:-}" = --live ]; then
  live=true
  shift
fi
if [ $# -ne 1 ]; then
  sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 1
fi
source=$1

app_db=$(env_value DB_DATABASE)
app_db=${app_db:-app}
app_user=$(env_value DB_USERNAME)
app_user=${app_user:-app}
stamp=$(date -u +%Y%m%d%H%M%S)
if $live; then
  target=${app_db}_restoring
else
  target=restore_test
fi

admin_sql() {
  compose exec -T db psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres \
    -c "SET client_min_messages = warning" -c "$1" < /dev/null
}
drop_target() { admin_sql "DROP DATABASE IF EXISTS \"$target\" WITH (FORCE)" || true; }

dump=$(mktemp)
cleanup() {
  rm -f "$dump"
  # The test copy holds personal data, never leave it behind. A failed live
  # restore leaves nothing half-done either.
  drop_target
}
trap cleanup EXIT

# A download URL carries its access token, so only the file name is printed
echo ">> Fetching backup ${source##*/}"
if [[ $source == https://* ]]; then
  curl --fail --silent --show-error -o "$dump" "$source"
else
  cp "$source" "$dump"
fi
echo "   $(wc -c < "$dump") bytes"
# Refuses anything that isn't a readable pg_dump archive before a database is touched
compose exec -T db pg_restore --list < "$dump" > /dev/null

echo ">> Restoring into database $target"
drop_target
admin_sql "CREATE DATABASE \"$target\" OWNER \"$app_user\" ENCODING 'UTF8' TEMPLATE template0"
# Same rights as docker/db/initdb: only the app user (and superuser) may connect
admin_sql "REVOKE ALL ON DATABASE \"$target\" FROM PUBLIC"
# As the app user, so it owns everything like in the live database.
# --single-transaction: either the whole backup loads or nothing does.
compose exec -T db pg_restore -U "$app_user" -d "$target" \
  --no-owner --no-privileges --exit-on-error --single-transaction < "$dump"

row_counts() {
  compose exec -T db psql -X -At -F ' ' -U "$app_user" -d "$1" -c "
    SELECT table_name,
           (xpath('/row/c/text()', query_to_xml(
             format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name COLLATE \"C\"" < /dev/null
}
last_migration() {
  compose exec -T db psql -X -At -U "$app_user" -d "$1" \
    -c "SELECT migration FROM migrations ORDER BY id DESC LIMIT 1" < /dev/null
}

echo ">> Rows per table (backup vs live; live may have more, it has changed since the backup)"
# Assigned first so a failing query stops the script
restored=$(row_counts "$target")
current=$(row_counts "$app_db")
{
  echo "table backup live"
  LC_ALL=C join -a 1 -e - -o 0,1.2,2.2 <(echo "$restored") <(echo "$current")
} | column -t
echo ">> Latest migration in backup: $(last_migration "$target")"
echo ">> Latest migration in live:   $(last_migration "$app_db")"

if ! $live; then
  echo ">> Test restore OK. Dropping $target"
  exit 0
fi

old=${app_db}_before_restore_$stamp
echo
echo "!! This replaces database '$app_db' with the backup above."
echo "   The current database is kept as '$old'. The site's API is down meanwhile."
read -r -p "   Type the database name ($app_db) to continue: " answer || answer=
if [ "$answer" != "$app_db" ]; then
  echo "Aborted, live database not changed"
  exit 1
fi

echo ">> Stopping backend"
compose stop backend backup
# From here on nothing is dropped automatically, whatever fails
trap 'rm -f "$dump"' EXIT
admin_sql "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$app_db' AND pid <> pg_backend_pid()" > /dev/null
admin_sql "ALTER DATABASE \"$app_db\" RENAME TO \"$old\""
admin_sql "ALTER DATABASE \"$target\" RENAME TO \"$app_db\""

echo ">> Running migrations newer than the backup, starting containers"
compose run --rm backend php artisan migrate --force
compose up -d

echo
echo ">> Restored. Check the site, then delete the old database:"
echo "   docker compose --env-file .env.production -f docker-compose.prod.yml exec db psql -U postgres -c 'DROP DATABASE \"$old\"'"
echo "   To undo instead: stop backend, rename '$app_db' away and '$old' back to '$app_db'."
