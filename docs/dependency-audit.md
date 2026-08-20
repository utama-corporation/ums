# Dependency Audit

Run with `pnpm audit` on 2026-08-20 against the full workspace lockfile.

## Summary

| Severity | Count |
|---|---|
| Critical | 1 |
| High | 14 |
| Moderate | 21 |
| Low | 3 |

## Findings requiring a major-version migration (not fixed in this pass)

All three real findings below have no available fix within their current
major version — the installed version is already the latest release on that
major line. Closing them means a framework/tooling migration, not a patch
bump, so each is a deliberate follow-up decision rather than something to
bundle into routine dependency maintenance.

### Next.js 14.2.35 → requires 15.x

39 advisories affecting `next`, several **HIGH**: SSRF in Server Actions on
custom servers (GHSA-89xv-2m56-2m9x), SSRF via attacker-controlled rewrite
destinations (GHSA-p9j2-gv94-2wf4), DoS in Server Actions
(GHSA-m99w-x7hq-7vfj), Middleware/Proxy bypass in i18n apps
(GHSA-36qx-fr4f-26g5), WebSocket upgrade SSRF (GHSA-c4j6-fc7j-m34r), plus a
dozen moderate cache-poisoning/XSS/DoS issues. All patched only in `>=15.x`
releases (the fix versions cited range from 15.0.8 up to 15.5.21 — Next 15
itself needed multiple point releases to close all of these).

**Decision (2026-08-20): do not upgrade now.** Next 14.2.35 is already the
newest 14.x release, so there is no smaller step available. A 14→15 jump
carries real App Router breaking-change risk, and the UI was just
extensively redesigned and tested this session — bundling a framework major
version bump into that same window of change is exactly the kind of risk
stacking worth avoiding. Track this as an open item for a dedicated
migration pass with its own regression testing, not something to fix
incidentally.

**Real-world exposure today:** most of these require either a custom
server (this app deploys via `next start`/Docker, not a custom server —
lowers exposure for the custom-server SSRF ones), Server Actions with
attacker-reachable destinations, or i18n middleware (not used here). Not
zero-risk, but not the most exposed configuration either.

### nodemailer 6.10.1 → requires 9.x

Multiple advisories across the 6.x/7.x/8.x lines culminating in fixes only
present by 9.0.1+: SSRF and arbitrary file read via the message-level `raw`
option bypassing `disableFileAccess`/`disableUrlAccess` (GHSA-p6gq-j5cr-w38f,
**HIGH**), ReDoS in `addressparser` (GHSA-rcmh-qjqh-p98v, **HIGH**), plus
several CRLF/header-injection and TLS-validation issues (moderate).

**Not fixed now** — same reasoning as Next.js: three major versions between
current and patched, and this is used in production email sending
(`apps/worker/src/mailer.ts`, exercised by every notification and the new
SMTP test-email feature). A jump this size needs its own changelog review
and testing pass, not a blind bump.

**Mitigating factor:** this codebase never passes user-controlled content
into the vulnerable surfaces — `sendEmailNotification()` takes a fixed `to`
address (always a `User.email` from the database, never request input) and
constructs `html` from either hardcoded strings or the admin-only
[email template system](../apps/web/src/app/settings/page.tsx) (gated by
`settings.manage` permission), never end-user input. The `raw`/`envelope`
options implicated in the worst advisories are never used at all. Real
exposure is lower than the advisory severity implies, but the gap should
still close eventually.

### vitest 2.1.9 → requires 3.x

One **CRITICAL** advisory (GHSA-5xrq-8626-4rwp): when Vitest's UI server is
listening, arbitrary files can be read and executed. Fixed in `>=3.2.6`.

**Not fixed now**, but genuinely low real-world risk here: this is a
`devDependency` only (never shipped or run in production), and the project
never runs `vitest --ui` (only `vitest run` in every `test` script — see
each `package.json`). The vulnerable server is never started. Still worth
closing on the next tooling-maintenance pass since it's dev-only and lower
risk to bump than the other two.

## Lower-severity / transitive, not independently actionable

- **postcss** (via Next.js's build pipeline) — source-map path traversal /
  XSS issues, patched versions exist but postcss is pulled in by `next`
  itself; bumping it standalone via a pnpm override risks an
  untested postcss/Next.js combination for no real gain, since the actual
  fix path is the Next.js upgrade above.
- **vite / esbuild** (via `vitest`) — dev-server request-forwarding and path
  traversal issues, same story: transitive from `vitest`, real fix is the
  vitest 3.x upgrade above.
- **glob 7.2.3** (via `eslint` → `file-entry-cache` → `flat-cache` →
  `rimraf`) — HIGH-rated command-injection advisory, but the vulnerable
  surface is glob's own CLI `-c/--cmd` flag, which nothing in this
  codebase invokes (glob is used here only as a library dependency deep in
  eslint's own tooling). Rated HIGH by the advisory database but not a
  realistic exposure in how it's actually reached here.

## Recommendation

Revisit this file the next time dependency maintenance is scheduled
(suggest: alongside the eventual Next.js 15 migration, since upgrading
nodemailer and vitest at the same time is a reasonable batch — they're
independent of Next.js and of each other, so could also be done sooner in
isolation if desired). Re-run `pnpm audit` after any of these to confirm
the fix actually lands and nothing new appeared in the meantime.
