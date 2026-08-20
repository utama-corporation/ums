#!/usr/bin/env bash
# Dumps the production PostgreSQL database to a timestamped, gzip-compressed,
# integrity-checked file. Safe to run repeatedly (e.g. from cron) — never
# touches the running database beyond a read-only pg_dump.
#
# Usage:
#   infra/scripts/backup-postgres.sh
#
# Env overrides (all optional):
#   ENV_FILE=/path/to/.env.production   (default: <repo root>/.env.production)
#   BACKUP_DIR=/path/to/backups         (default: <repo root>/backups/postgres)
#   RETENTION_DAYS=14                   (default: 14)
#   CONTAINER_NAME=ums-postgres         (default: ums-postgres)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
CONTAINER_NAME="${CONTAINER_NAME:-ums-postgres}"

if [ ! -f "$ENV_FILE" ]; then
  echo "[backup-postgres] ERROR: env file not found at $ENV_FILE" >&2
  exit 1
fi

POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
POSTGRES_USER="${POSTGRES_USER:-ums_user}"
POSTGRES_DB="${POSTGRES_DB:-ums_db}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "[backup-postgres] ERROR: container '$CONTAINER_NAME' is not running" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="$BACKUP_DIR/ums_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
TMP_FILE="${OUT_FILE}.partial"

echo "[backup-postgres] Dumping database '$POSTGRES_DB' (user '$POSTGRES_USER') from container '$CONTAINER_NAME'..."

if ! docker exec "$CONTAINER_NAME" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists | gzip > "$TMP_FILE"; then
  echo "[backup-postgres] ERROR: pg_dump failed" >&2
  rm -f "$TMP_FILE"
  exit 1
fi

mv "$TMP_FILE" "$OUT_FILE"

if ! gzip -t "$OUT_FILE"; then
  echo "[backup-postgres] ERROR: backup file failed gzip integrity check, removing corrupt file" >&2
  rm -f "$OUT_FILE"
  exit 1
fi

SIZE="$(du -h "$OUT_FILE" | cut -f1)"
echo "[backup-postgres] OK: $OUT_FILE ($SIZE), integrity check passed."

DELETED=0
while IFS= read -r -d '' old; do
  rm -f "$old"
  echo "[backup-postgres] Pruned old backup: $old"
  DELETED=$((DELETED + 1))
done < <(find "$BACKUP_DIR" -name 'ums_*.sql.gz' -mtime "+${RETENTION_DAYS}" -print0)

echo "[backup-postgres] Done. ($DELETED old backup(s) pruned, retention=${RETENTION_DAYS}d)"
