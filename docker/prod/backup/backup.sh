#!/bin/sh
# Daily PostgreSQL backup to Oracle Cloud Object Storage.
#
#   backup schedule   run forever, one backup per day at BACKUP_AT (UTC)
#   backup now        take one backup right away
#   backup health     container healthcheck
#
# BACKUP_UPLOAD_URL is a pre-authenticated request (PAR) URL for the bucket
# that may only write objects (see deploy/backup-storage.sh). The server can
# add backups but can't list, read or delete them. Oracle deletes them after
# 7 days (bucket lifecycle rule).
set -eu

STATE_DIR=/tmp/backup
LAST_OK=$STATE_DIR/last-success
FAILED=$STATE_DIR/failed
STARTED=$STATE_DIR/started

log() { echo "$(date -u +%FT%TZ) $*"; }

configured() {
  case "${BACKUP_UPLOAD_URL:-}" in
    https://*/p/*/o/ | https://*/p/*/o) return 0 ;;
    *) return 1 ;;
  esac
}

backup_now() {
  if ! configured; then
    log "BACKUP_UPLOAD_URL is not set in .env.production, see Backups in README.md" >&2
    exit 1
  fi
  mkdir -p "$STATE_DIR"

  suffix=$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')
  name="$PGDATABASE-$(date -u +%Y%m%dT%H%M%SZ)-$suffix.dump"
  file="$STATE_DIR/$name"
  trap 'rm -f "$file"' EXIT

  log "Dumping database $PGDATABASE"
  pg_dump --format=custom --file="$file"
  # Fails if the archive is truncated or unreadable
  pg_restore --list "$file" > /dev/null

  log "Uploading $name ($(wc -c < "$file") bytes)"
  curl --fail-with-body --silent --show-error --retry 3 --max-time 3600 \
    --upload-file "$file" \
    -H "Content-Type: application/octet-stream" \
    "${BACKUP_UPLOAD_URL%/}/$name"

  touch "$LAST_OK"
  rm -f "$FAILED"
  log "Backup done: $name"
}

schedule() {
  mkdir -p "$STATE_DIR"
  touch "$STARTED"
  configured || log "WARNING: BACKUP_UPLOAD_URL is not set, backups will fail" >&2

  # docker stop sends SIGTERM to PID 1, which sh ignores without a trap
  trap 'exit 0' TERM INT

  at=${BACKUP_AT:-02:00}
  hour=${at%%:*}
  minute=${at#*:}
  offset=$(( ${hour#0} * 3600 + ${minute#0} * 60 ))

  while :; do
    now=$(date -u +%s)
    next=$(( now - now % 86400 + offset ))
    [ "$next" -gt "$now" ] || next=$(( next + 86400 ))
    log "Next backup at $(date -u -d "@$next" +%FT%TZ)"
    sleep $(( next - now )) &
    wait $!

    # Separate process, so set -e applies inside it
    for attempt in 1 2 3; do
      if "$0" now; then
        break
      fi
      log "Backup attempt $attempt of 3 failed" >&2
      if [ "$attempt" -lt 3 ]; then
        sleep 600 &
        wait $!
      else
        touch "$FAILED"
      fi
    done
  done
}

health() {
  if ! configured; then
    echo "BACKUP_UPLOAD_URL is not set"
    exit 1
  fi
  if [ -e "$FAILED" ]; then
    echo "last backup failed, see: docker compose logs backup"
    exit 1
  fi
  # A backup in the last 26 hours, or the container is new and the first
  # scheduled backup hasn't happened yet
  if [ -n "$(find "$LAST_OK" "$STARTED" -mmin -1560 2> /dev/null)" ]; then
    exit 0
  fi
  echo "no successful backup in the last 26 hours"
  exit 1
}

case "${1:-}" in
  schedule) schedule ;;
  now) backup_now ;;
  health) health ;;
  *)
    echo "usage: backup schedule|now|health" >&2
    exit 1
    ;;
esac
