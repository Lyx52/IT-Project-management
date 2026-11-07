#!/bin/sh
# Runs once, on the first start with an empty data volume.
# Tables are created by Laravel migrations, not here.
set -eu

echo "Creating app role '$APP_DB_USER' and database '$APP_DB_NAME'"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v app_user="$APP_DB_USER" \
  -v app_pass="$APP_DB_PASSWORD" \
  -v app_db="$APP_DB_NAME" <<'EOSQL'
-- Least privilege: can log in and own its own database, nothing else
CREATE ROLE :"app_user" LOGIN PASSWORD :'app_pass'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

CREATE DATABASE :"app_db" OWNER :"app_user"
  ENCODING 'UTF8' TEMPLATE template0;

-- Only the app user (and superuser) may connect
REVOKE ALL ON DATABASE :"app_db" FROM PUBLIC;
REVOKE CONNECT ON DATABASE postgres FROM PUBLIC;
EOSQL
