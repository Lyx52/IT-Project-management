# Daily database backup to Oracle Cloud Object Storage, see docker/prod/backup/backup.sh.
# Build context is the repo root.

FROM alpine:3.22

# pg_dump must be the same major version as the server (postgres:17-alpine)
RUN apk add --no-cache postgresql17-client curl

COPY --chmod=755 docker/prod/backup/backup.sh /usr/local/bin/backup

USER nobody
HEALTHCHECK --interval=5m --timeout=10s --start-period=30s CMD ["backup", "health"]
ENTRYPOINT ["backup"]
CMD ["schedule"]
