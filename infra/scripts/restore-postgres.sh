#!/usr/bin/env bash
# Restores a PostgreSQL backup produced by backup-postgres.sh.
#
# IMPORTANT: restoring into the production database is destructive — every
# table is dropped and recreated from the dump (the dump was taken with
# --clean --if-exists). Always prefer a restore drill first:
#
#   infra/scripts/restore-postgres.sh backups/postgres/ums_ums_db_XXXX.sql.gz --target-db=ums_db_restore_test
#
# That restores into a separate, throwaway database so you can verify the
# backup is actually valid without touching production data at all.
#
# Usage:
#   infra/scripts/restore-postgres.sh <backup-file.sql.gz> [--target-db=NAME] [--yes]
#
#   --target-db=NAME   Restore into database NAME instead of the production DB.
#                       Use this for restore drills.
#   --yes               Skip the interactive confirmation prompt (for scripted use).
set -euo pipefail

usage() {
  echo "Usage: $0 <backup-file.sql.gz> [--target-db=NAME] [--yes]" >&2
  exit 1
}

[ $# -ge 1 ] || usage
BACKUP_FILE="$1"; shift

TARGET_DB_OVERRIDE=""
SKIP_CONFIRM="false"
for arg in "$@"; do
  case "$arg" in
    --target-db=*) TARGET_DB_OVERRIDE="${arg#*=}" ;;
    --yes) SKIP_CONFIRM="true" ;;
    *) echo "Unknown argument: $arg" >&2; usage ;;
  esac
done

[ -f "$BACKUP_FILE" ] || { echo "ERROR: backup file not found: $BACKUP_FILE" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env.production}"
COMPOSE_FILE="$REPO_ROOT/docker-compose.prod.yml"
CONTAINER_NAME="${CONTAINER_NAME:-ums-postgres}"

[ -f "$ENV_FILE" ] || { echo "ERROR: env file not found at $ENV_FILE" >&2; exit 1; }

POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
POSTGRES_USER="${POSTGRES_USER:-ums_user}"
POSTGRES_DB="${POSTGRES_DB:-ums_db}"

TARGET_DB="${TARGET_DB_OVERRIDE:-$POSTGRES_DB}"
IS_PRODUCTION_TARGET="false"
[ "$TARGET_DB" = "$POSTGRES_DB" ] && IS_PRODUCTION_TARGET="true"

echo "=============================================================="
echo " Backup file : $BACKUP_FILE"
echo " Container   : $CONTAINER_NAME"
echo " Target DB   : $TARGET_DB"
if [ "$IS_PRODUCTION_TARGET" = "true" ]; then
  echo " !!  THIS IS THE PRODUCTION DATABASE.  !!"
  echo " !!  Every table in it will be dropped and replaced with the backup's contents.  !!"
else
  echo " (restore-drill mode — separate database, production data is untouched)"
fi
echo "=============================================================="

if [ "$SKIP_CONFIRM" != "true" ]; then
  read -r -p "Type 'yes' to continue: " CONFIRM
  [ "$CONFIRM" = "yes" ] || { echo "Aborted."; exit 1; }
fi

if [ "$IS_PRODUCTION_TARGET" = "true" ]; then
  echo "[restore-postgres] Stopping api and worker so nothing writes during restore..."
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" stop api worker
fi

DB_EXISTS="$(docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='$TARGET_DB'")"
if [ "$DB_EXISTS" != "1" ]; then
  echo "[restore-postgres] Database '$TARGET_DB' does not exist yet, creating it..."
  docker exec "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"$TARGET_DB\" OWNER \"$POSTGRES_USER\";"
fi

echo "[restore-postgres] Restoring from $BACKUP_FILE into '$TARGET_DB'..."
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$POSTGRES_USER" -d "$TARGET_DB" -v ON_ERROR_STOP=1

echo "[restore-postgres] Restore finished."

if [ "$IS_PRODUCTION_TARGET" = "true" ]; then
  echo "[restore-postgres] Restarting api and worker..."
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" start api worker
  echo "[restore-postgres] Done. Log in and spot-check the app to confirm the restore looks correct."
else
  echo "[restore-postgres] Restore-drill database '$TARGET_DB' is ready to inspect, e.g.:"
  echo "    docker exec -it $CONTAINER_NAME psql -U $POSTGRES_USER -d $TARGET_DB -c '\\dt'"
  echo "  Drop it when you're done:"
  echo "    docker exec $CONTAINER_NAME psql -U $POSTGRES_USER -d postgres -c 'DROP DATABASE \"$TARGET_DB\";'"
fi
