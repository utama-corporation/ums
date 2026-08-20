# Backup & Restore Runbook

This is the executable counterpart to the one-liner in
[deployment.md](./deployment.md#known-limitations-to-be-aware-of-before-real-production-traffic).
It covers PostgreSQL (all application data) and MinIO (uploaded memo
attachments) — the two stores that hold data you cannot regenerate.

Everything here runs **on the Ubuntu server**, from the repo root
(`/development/ums` in the current deployment), using the scripts in
`infra/scripts/`.

## What gets backed up, and what doesn't

| Store | Backed up by | Contains |
|---|---|---|
| PostgreSQL (`postgres_data` volume) | `backup-postgres.sh` | Every application record: users, memos, workflows, approvals, dispositions, notifications, audit log, settings. |
| MinIO (`minio_data` volume) | `backup-minio.sh` | Uploaded memo attachment files. |
| Redis (`redis_data` volume) | **Not backed up** | Session/rate-limit state only — safe to lose, it rebuilds itself from normal traffic. Not disaster-recovery relevant. |

If Postgres and MinIO backups are both current, a full server loss is
recoverable. Redis is intentionally excluded — backing it up would add
complexity for data that's fine to lose.

## Ownership and schedule

- **Owner:** whoever holds the Ubuntu server's root/sudo access (currently
  the person who ran the initial deployment). Update this line when that
  changes — an owner-less backup job is a backup job nobody notices when it
  breaks.
- **Schedule:** daily, via cron (setup below). Daily is a reasonable default
  for an internal memo system; tighten to hourly only if the business
  decides same-day data loss is unacceptable.
- **Retention:** 14 days by default (`RETENTION_DAYS` in both scripts).
  Older backups are pruned automatically on each run.
- **Storage location:** backups land in `backups/postgres/` and
  `backups/minio/` under the repo root by default — **on the same disk as
  the database itself.** This protects against accidental `DROP TABLE` or a
  bad migration, but **not** against the server or disk dying entirely.
  Before this is relied on for real disaster recovery, point `BACKUP_DIR` at
  a mounted network volume, or add an off-box sync step (`rsync`/`rclone` to
  another machine or object storage) after each backup run. That off-box
  step is not implemented yet — treat local-only backups as a stopgap, not
  the final state.

## One-time setup

```bash
cd /development/ums
infra/scripts/backup-postgres.sh   # first manual run — confirms it works before you automate it
infra/scripts/backup-minio.sh
```

Both scripts read connection details from `.env.production` automatically —
no extra configuration needed.

### Install the daily cron job

```bash
crontab -e
```

Add:

```cron
# UMS: daily backup at 02:00 server time
0 2 * * * cd /development/ums && infra/scripts/backup-postgres.sh >> /var/log/ums-backup.log 2>&1
15 2 * * * cd /development/ums && infra/scripts/backup-minio.sh >> /var/log/ums-backup.log 2>&1
```

The 15-minute offset just avoids both jobs hitting Docker at the exact same
second. Check `/var/log/ums-backup.log` periodically — a backup job that's
silently been failing for a month is worse than no backup job, because it
gives false confidence.

## Restoring

**Always drill first, restore for real only when you mean it.** The restore
script defaults to touching production; pass `--target-db` to redirect it
to a throwaway database instead.

### Restore drill (safe, does not touch production)

```bash
infra/scripts/restore-postgres.sh backups/postgres/ums_ums_db_20260820T020000Z.sql.gz \
  --target-db=ums_db_restore_test
```

This creates a separate `ums_db_restore_test` database, restores the dump
into it, and leaves production untouched. Verify it worked:

```bash
docker exec -it ums-postgres psql -U ums_user -d ums_db_restore_test -c "\dt"
docker exec -it ums-postgres psql -U ums_user -d ums_db_restore_test -c "SELECT count(*) FROM \"User\";"
```

Then drop the drill database:

```bash
docker exec ums-postgres psql -U ums_user -d postgres -c 'DROP DATABASE "ums_db_restore_test";'
```

### Real restore (destructive — production data is replaced)

```bash
infra/scripts/restore-postgres.sh backups/postgres/ums_ums_db_20260820T020000Z.sql.gz
```

The script will:
1. Print a warning and require you to type `yes`.
2. Stop the `api` and `worker` containers (so nothing writes mid-restore).
3. Drop and recreate every table from the dump (the dump was taken with
   `pg_dump --clean --if-exists`, so this is built into the file itself).
4. Restart `api` and `worker`.

After it finishes, log in and spot-check: recent memos, user list, a
disposition or two. Don't assume success just because the script exited 0 —
`psql -v ON_ERROR_STOP=1` means a genuinely broken restore does fail loudly,
but a *silently incomplete* one (e.g. restoring a backup taken before a
feature existed) will not raise an error, only look wrong on inspection.

### Restoring MinIO attachments

There's no scripted restore for MinIO — a mirrored snapshot in
`backups/minio/<timestamp>/` is already plain files matching the bucket's
key layout, so restoring is a straight copy back in:

```bash
NETWORK=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' ums-minio)
docker run --rm --network "$NETWORK" \
  -v "$(pwd)/backups/minio/20260820T020000Z:/restore" \
  minio/mc:latest \
  /bin/sh -c "mc alias set local http://minio:9000 \$S3_ACCESS_KEY \$S3_SECRET_KEY && mc mirror /restore local/ums-attachments"
```

(Fill in the real access/secret key from `.env.production`, or export them
first.)

## Restore drill schedule

A backup nobody has ever restored is a hope, not a plan. Run the restore
drill above **monthly**, and actually check the row counts and a sample
record look right — not just that the command exited without error. Log the
date of the last successful drill somewhere visible (this file is as good a
place as any):

| Date | Run by | Result |
|---|---|---|
| _(not yet run)_ | | |

## Known gaps in this runbook

- **No off-box copy of backups yet** — see "Storage location" above. A
  disk-level failure on the server currently takes the backups with it.
- **No automated alerting on backup failure** — cron logs to a file, nobody
  gets paged. Fine for the current scale; revisit if this system becomes
  more business-critical.
- **MinIO restore is manual, not scripted** — acceptable for now since
  attachment loss is recoverable-but-annoying rather than catastrophic
  (unlike losing the Postgres data), but a `restore-minio.sh` script would
  close this gap if it's worth the time later.
