#!/usr/bin/env bash
# Mirrors the MinIO attachment bucket to a timestamped local directory. Uses a
# throwaway `minio/mc` container on the same Docker network as the stack —
# MinIO itself is not exposed to the host, so this is the only way in.
#
# Usage:
#   infra/scripts/backup-minio.sh
#
# Env overrides (all optional):
#   ENV_FILE=/path/to/.env.production   (default: <repo root>/.env.production)
#   BACKUP_DIR=/path/to/backups         (default: <repo root>/backups/minio)
#   RETENTION_DAYS=14                   (default: 14)
#   MINIO_CONTAINER=ums-minio           (default: ums-minio)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups/minio}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
MINIO_CONTAINER="${MINIO_CONTAINER:-ums-minio}"

[ -f "$ENV_FILE" ] || { echo "[backup-minio] ERROR: env file not found at $ENV_FILE" >&2; exit 1; }

S3_ACCESS_KEY="$(grep -E '^S3_ACCESS_KEY=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
S3_SECRET_KEY="$(grep -E '^S3_SECRET_KEY=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
S3_BUCKET="$(grep -E '^S3_BUCKET=' "$ENV_FILE" | tail -1 | cut -d= -f2- || true)"
S3_BUCKET="${S3_BUCKET:-ums-attachments}"

if [ -z "$S3_ACCESS_KEY" ] || [ -z "$S3_SECRET_KEY" ]; then
  echo "[backup-minio] ERROR: S3_ACCESS_KEY / S3_SECRET_KEY not found in $ENV_FILE" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$MINIO_CONTAINER"; then
  echo "[backup-minio] ERROR: container '$MINIO_CONTAINER' is not running" >&2
  exit 1
fi

NETWORK="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$MINIO_CONTAINER")"
if [ -z "$NETWORK" ]; then
  echo "[backup-minio] ERROR: could not detect the Docker network for $MINIO_CONTAINER" >&2
  exit 1
fi

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST_DIR="$BACKUP_DIR/$TIMESTAMP"
mkdir -p "$DEST_DIR"

echo "[backup-minio] Mirroring bucket '$S3_BUCKET' to $DEST_DIR (network: $NETWORK)..."
docker run --rm \
  --network "$NETWORK" \
  -v "$DEST_DIR:/backup" \
  minio/mc:latest \
  /bin/sh -c "mc alias set local http://minio:9000 '$S3_ACCESS_KEY' '$S3_SECRET_KEY' >/dev/null && mc mirror --quiet local/$S3_BUCKET /backup"

FILE_COUNT="$(find "$DEST_DIR" -type f | wc -l)"
if [ "$FILE_COUNT" -eq 0 ]; then
  echo "[backup-minio] WARNING: 0 files mirrored — bucket may be empty, or mirroring failed silently. Check above output."
else
  echo "[backup-minio] OK: $FILE_COUNT file(s) mirrored to $DEST_DIR"
fi

DELETED=0
while IFS= read -r -d '' old; do
  rm -rf "$old"
  echo "[backup-minio] Pruned old snapshot: $old"
  DELETED=$((DELETED + 1))
done < <(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -print0)

echo "[backup-minio] Done. ($DELETED old snapshot(s) pruned, retention=${RETENTION_DAYS}d)"
