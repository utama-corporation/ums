# @ums/e2e

Playwright end-to-end tests covering the business-critical journeys from the
PRD's acceptance scenarios, driven through the real browser UI wherever a UI
exists:

- **critical-path** — login → create+submit a memo → approve → publish →
  issue a disposition → assignee sees the task
- **reject-and-resubmit** — approver requests revision → memo goes back to
  REVISION → author resubmits → approver approves
- **parallel-approval** — a PARALLEL/ALL-policy step with two approvers; the
  memo must wait for both, not just one
- **distribution-and-read-receipt** — distribute → recipient sees it unread
  in their inbox → read-receipt flips the badge to read
- **publication-verify** — publish → the QR/document verification token
  resolves as valid on the public `/verify/:token` page
- **archive-and-restore** — publish → archive → appears in the Archive list
  → restore → disappears again
- **external-link** — distributing to an EXTERNAL recipient generates an
  access token → the public link renders the memo
- **report-export** — request a CSV export → the worker completes it → a
  real download link appears

## Prerequisites

- Postgres reachable at the `DATABASE_URL` in the repo root `.env`, migrated
  and seeded (`pnpm db:migrate && pnpm db:seed`) — tests log in as the
  seeded `admin`, `staff`, `depthead`, `memo.admin`, `auditor`, and
  `approver` accounts (see `global-setup.ts`).
- MinIO/S3 reachable at `S3_ENDPOINT` — publish uploads a canonical PDF, so
  this is a hard requirement for every test that publishes a memo. If you
  don't have the usual MinIO container reachable, run a standalone one:
  ```bash
  minio.exe server ./minio-data --address :9000
  # then, with mc (https://min.io/docs/minio/windows/reference/minio-mc.html):
  mc alias set local http://localhost:9000 minioadmin minioadmin
  mc mb --ignore-existing local/ums-attachments
  ```
  and point `S3_ENDPOINT=http://localhost:9000` in `.env` for the run.
- The **worker** actually running (`report-export.spec.ts` needs it — see
  playwright.config.ts's third `webServer` entry, which starts it
  automatically same as api/web).
- Mailpit or another SMTP sink at `SMTP_HOST`/`SMTP_PORT` — not required for
  tests to pass (email failures are non-fatal by design, see
  `apps/worker/src/outboxWorker.ts`), but you'll see `[MAILER_ERROR]` noise
  in the API server log if it's missing.

## Running

```bash
pnpm test:e2e
```

This starts `@ums/api`, `@ums/web`, and `@ums/worker` in dev mode
automatically if they aren't already running, and reuses them if they are.
Every spec file creates its own master data (category, memo type, workflow)
via API calls in `beforeAll` with a run-unique suffix, so the whole suite is
self-contained and safe to re-run repeatedly.

Override the target with env vars if needed:

```bash
E2E_WEB_URL=http://localhost:5000 E2E_API_URL=http://localhost:5500 pnpm test:e2e
```

Set `E2E_SKIP_WEBSERVER=1` to point tests at servers you're already running
yourself (e.g. against a deployed environment) instead of letting Playwright
manage them.

### Why login happens once, in `global-setup.ts`, not per-test

The login endpoint is rate-limited — 15 requests per 15 minutes per IP (see
`apps/api/src/middleware/authMiddleware.ts`'s `authRateLimiter`, a real
security control, not something to weaken for testing). Early versions of
this suite had every spec log in fresh for every actor switch — with 8 spec
files each switching between 2-4 actors, that's 25-30+ login calls in one
run, comfortably tripping `TOO_MANY_REQUESTS` on a full suite run regardless
of how clean the environment is.

The fix: `global-setup.ts` logs in **once per role** (6 accounts total) and
saves each session's cookies via Playwright's `storageState`. Every spec
then opens a `browser.newContext({ storageState: ... })` per actor via the
`newPageAsUser()` / `newApiContextAsUser()` helpers in `tests/helpers.ts`
instead of filling in the login form or POSTing `/auth/login` again — actor
switches become free (a context per actor within one test), and the whole
suite's login count stays flat at 6 no matter how many spec files exist.

Also run tests with a single worker (`workers: 1` in `playwright.config.ts`)
— every spec logs in as the same handful of seeded accounts, and concurrent
workers hitting the same session/DB rows in parallel caused unrelated
failures before this was set.

## Known product gaps this suite surfaced

None of these are test limitations — each is something the real UI/backend
doesn't support yet, discovered by trying to drive it through Playwright and
reading the actual route/service code when a UI path didn't exist.

- **No UI to create a disposition.** `apps/web` has pages to view tasks
  (`/tasks/assigned`, `/tasks/issued`) and update/verify progress on
  existing ones, but no form anywhere for an issuer to create a new
  disposition and assign tasks — despite the backend (`POST
  /memos/:id/dispositions`) fully supporting it. `critical-path.spec.ts`
  creates the disposition via a direct API call and verifies the rest
  (notification, task appearing in the assignee's list) through the UI.

- **Read receipts can never be marked through the UI.** `POST
  /memos/:id/read-receipt` exists and works, but nothing in
  `apps/web/src/app/memos/[id]/page.tsx` — not even on page load — ever
  calls it. Viewing a distributed memo does not mark it read; there's no
  "mark as read" button either. `distribution-and-read-receipt.spec.ts`
  calls the endpoint directly via API to flip the badge, then verifies the
  UI reflects it.

- **The memo creation UI cannot add an EXTERNAL recipient.** The "Penerima"
  section on `/memos/new` literally says "Penerima eksternal akan tersedia
  pada iterasi berikutnya" (external recipients coming in a later
  iteration). `external-link.spec.ts` creates the memo with an EXTERNAL
  recipient via API instead — the only UI-driven parts of that test are the
  "Distribusikan" button (which is what actually generates the access
  token) and the public `/external/memos/:token` landing page.

- **External link revocation doesn't exist.** `ExternalRecipientAccess.revokedAt`
  is a real schema column, but no route or service anywhere ever writes to
  it — tokens can only expire (hardcoded 7 days from `distributeMemo()`),
  never be revoked early. `external-link.spec.ts` only covers generation +
  successful access; there's nothing to test for revocation because the
  feature isn't there.

- **Revising a PUBLISHED memo doesn't exist at all**, despite
  `Memo.revisesMemoId` being a real schema column with a self-relation. No
  route or service ever sets it — `POST /memos/:id/copy` creates an
  unrelated new draft (not linked via `revisesMemoId`), and there's no
  "Buat Revisi" button anywhere. No test was written for this since there's
  nothing to drive.

If any of these are meant to be usable day-to-day, that's real product
work, not something this test suite can paper over.

## Test data cleanup

Every run creates real rows in the target database (memos, categories,
workflows — all prefixed with `E2E`). Nothing here auto-deletes them, since
a failed run's leftovers are useful for debugging. To clean up manually:

```sql
DELETE FROM "Memo" WHERE title LIKE '%E2E%';
DELETE FROM "WorkflowDefinition" WHERE name LIKE '%E2E%';
DELETE FROM "Category" WHERE name LIKE '%E2E%';
DELETE FROM "MemoType" WHERE name LIKE '%E2E%';
DELETE FROM "Notification" WHERE title LIKE '%E2E%';
```

(All the memo/workflow child tables cascade-delete, so those two `DELETE`s
are enough to remove everything each run created.)
