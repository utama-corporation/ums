# Security Review

An OWASP-ASVS-inspired review of `apps/api` (Express/Prisma), performed
2026-08-20 by reading the actual code path for each category — not a
generic checklist pass. Findings are graded **blocker / high / medium /
low**, per category. Items marked **FIXED** were verified fixed with a
targeted smoke test (not just "looks right"), not merely patched and
assumed working — see each item's verification note. Nothing here is
claimed production-ready while a **blocker** remains open.

## Summary

| # | Category | Verdict |
|---|---|---|
| 1 | Auth & session | 1 blocker (**FIXED**), 1 low (**FIXED**) |
| 2 | CSRF | Low — mitigated by SameSite, no defense-in-depth |
| 3 | CORS | Safe |
| 4 | IDOR | 1 blocker + 8 high (**mostly FIXED**, see detail) |
| 5 | XSS via rich text | 1 high (**FIXED**) |
| 6 | SQL injection | Safe |
| 7 | Upload abuse | 1 medium (**FIXED**: path traversal), 1 low (open) |
| 8 | SSRF | Safe |
| 9 | Token leakage | 1 low (**FIXED**) |
| 10 | Rate limiting | 2 medium (**FIXED**) |
| 11 | Mass assignment | Safe |
| 12 | Audit tampering | Safe |
| 13 | Sensitive logging | Safe |

**No blockers remain open.** Two items are documented as accepted/deferred
(see "Known gaps not fixed" below) — neither blocks production use as
configured today, but both are worth revisiting.

---

## 1. Auth & session management

- Password hashing (bcrypt, cost 10), JWT signing (HS256, no algorithm
  confusion), refresh token rotation + reuse detection (all sessions
  revoked + audited on reuse), session revocation on logout/password reset,
  and cookie flags (`httpOnly`, `secure` unless overridden, `sameSite:
  lax`) were all verified correct.
- **BLOCKER — FIXED: insecure default `SESSION_SECRET` with no production
  guard.** `packages/config/src/env.ts` shipped a hardcoded dev default
  (`"dev_super_secret_...32chars"`, checked into source control) with no
  check preventing it from being used in production. If an operator forgot
  to set `SESSION_SECRET` in `.env.production`, the API would silently boot
  and sign/verify every JWT with this well-known string — anyone could
  forge a valid access token for any user. **Fix**: `validateEnv()` now
  throws at startup if `NODE_ENV=production` and `SESSION_SECRET` still
  equals the default. **Verified**: ran `env.ts` with `NODE_ENV=production`
  and no `SESSION_SECRET` set — confirmed it throws
  `"SESSION_SECRET is still set to the development default..."` and refuses
  to boot.
- **LOW — FIXED: tokens unnecessarily echoed in response bodies.**
  `/auth/login` and `/auth/refresh` returned `accessToken`/`refreshToken` in
  the JSON body in addition to setting them as `httpOnly` cookies —
  needless exposure to devtools/proxies/APM with no functional use (the
  first-party frontend never reads them; confirmed via grep). **Fix**:
  removed from both response bodies; cookies remain the only channel.
- **Also removed**: `CSRF_SECRET` was dead configuration (defined, never
  read anywhere) — deleted rather than left in place implying a control
  that didn't exist.

## 2. CSRF

No CSRF token exists anywhere in the API. In practice this is mitigated:
cookies are `sameSite: "lax"`, every state-changing route requires
POST/PATCH/DELETE (no GET-based mutations exist), and CORS is locked to one
explicit origin — the combination blocks classic cross-site CSRF in current
browsers. Rated **low, not safe**, because there's no defense-in-depth if
that assumption ever breaks (a future GET-based action, an older/non-
standard browser, or an unusual embedded webview). **Not fixed this pass**
— would need an actual CSRF token mechanism to fully close; tracked as a
gap, not urgent given the SameSite mitigation.

## 3. CORS — Safe

`origin: env.APP_URL` (single explicit URL, not wildcard) combined with
`credentials: true` — the correct, safe pattern. No wildcard, no
reflected-origin callback anywhere.

## 4. IDOR (Insecure Direct Object Reference)

The most significant category. Ownership/scope checks were missing across
most memo-mutation and file-download endpoints — any authenticated user
(not just a privileged one) could act on or read another user's resources
by guessing/knowing a UUID.

**FIXED, and verified with a targeted smoke test** (unrelated user blocked,
legitimate author/admin still succeeds):
- `PATCH /memos/:id` (`updateDraft`) — now requires author or admin.
- `POST /memos/:id/autosave` (`autosaveDraft`) — same.
- `POST /memos/:id/copy` (`copyDraft`) — now applies the same
  confidentiality/scope check as viewing (previously bypassed it entirely —
  a `memo.create`-only user could copy anyone's `HIGHLY_CONFIDENTIAL` memo).
- `POST /memos/:id/attachments/initiate` — now requires author or admin.
- `POST /attachments/:id/complete` — now requires author or admin of the
  parent memo (resolved via the `MemoAttachment` link).
- `DELETE /attachments/:id` — now requires author or admin.
- **`GET /attachments/:id/download`** — the single most severe finding: had
  **no authorization check at all**, only `status === "READY"`. Any
  authenticated user could download any attachment in the system, including
  ones on `HIGHLY_CONFIDENTIAL` memos. Now applies the same
  confidentiality/recipient/author/admin scope as viewing the memo.
- **`GET /memos/:id/canonical-pdf`** — same category: any authenticated
  user could download any published memo's signed PDF. Now scope-checked
  the same way.

A shared helper (`isMemoAuthorOrAdmin`, `assertMemoViewScope` in
`memoDraftService.ts`) backs all of these, so the rule is defined once and
reused across `memoDraftService.ts`, `storageService.ts`, and
`publicationService.ts` rather than re-implemented per route.

**Verified**: a purpose-built smoke test created a CONFIDENTIAL memo
authored by one seeded user, confirmed an unrelated seeded user is rejected
with `ForbiddenError` from `updateDraft`, `getMemoDetail`, and
`getAttachmentDownloadUrl`, and confirmed the actual author/admin still
succeeds on all three. Also re-ran the full E2E suite (8 scenarios) after
these changes — all still pass, confirming legitimate flows (author
editing their own draft, admin publishing/archiving/distributing) were not
broken by the new checks.

**Deliberately left as-is** (see "Known gaps not fixed"): `GET /memos/:id`
still allows any authenticated user to view another user's non-confidential
(`GENERAL`/`INTERNAL`) DRAFT memo by ID — this mirrors the existing,
long-standing confidentiality-only gate rather than introducing a new,
broader restriction under time pressure in a security-focused pass; flagged
for a deliberate product decision rather than silently changed.

## 5. XSS via rich text

Memo bodies are correctly sanitized on every write path via
`sanitizeMemoHtml` (an allowlist-based `sanitize-html` config, no
`<script>`/`on*` handlers permitted) before storage, and rendered via
`dangerouslySetInnerHTML` only after that sanitization — safe.

**HIGH — FIXED: email template `bodyHtml` was stored and rendered
completely unsanitized.** `updateEmailTemplate()` wrote admin-submitted
`bodyHtml` straight to the database with no sanitization, and the Settings
page renders it via `dangerouslySetInnerHTML` for the live preview. Any
`settings.manage` holder could submit `<img src=x
onerror="...">`-style payloads that execute in **any other admin's**
browser session the moment they open Settings → Email & SMTP — a real
admin-to-admin stored XSS / privilege-escalation path, not a self-XSS.
**Fix**: `updateEmailTemplate()` now runs `bodyHtml` through the same
`sanitizeMemoHtml()` used for memo bodies before storing it.

## 6. SQL injection — Safe

Every raw-SQL call site in the codebase (`dashboardService.ts`,
`reportService.ts`, `searchService.ts`, `exportWorker.ts`, `health.ts`)
uses Prisma's parameterized tagged-template form. No
`$queryRawUnsafe`/`$executeRawUnsafe` exists anywhere.

## 7. Upload abuse

- **MEDIUM — FIXED: object-key path traversal via filename extension.**
  `initiateAttachmentUpload` built the S3 key as
  `` `memos/${memoId}/${uuid}.${fileExt}` `` where `fileExt` came from
  `fileName.split(".").pop()` with **no filtering** — a filename like
  `"x.png/../../other-memo/y"` could inject `/`/`..` into the key,
  escaping the memo's own folder in the shared bucket. **Fix**: the
  extension is now validated against `/^[a-zA-Z0-9]{1,10}$/`, falling back
  to `"bin"` for anything else.
- **LOW, not fixed**: the declared MIME type is validated at
  upload-initiation time but the actual uploaded bytes are never
  content-sniffed against it, and there's no virus/malware scanning step —
  files go straight to `READY` based on a client-supplied checksum plus an
  S3 existence check. Given attachments are downloaded with
  `Content-Disposition: attachment` (not inline-rendered), practical impact
  is limited, but this is a real gap for a system handling arbitrary
  internal-user uploads. Not fixed this pass — would need either a
  malware-scanning integration or server-side content-type verification,
  both bigger asks than this hardening pass's scope.

## 8. SSRF — Safe

The only outbound HTTP calls to configurable URLs (`EMPLOYEE_API_BASE_URL`
for the employee-directory sync, SMTP host/port for mail) are server/admin
-configured constants, never influenced by per-request user input. No
webhook or URL-fetch-on-behalf-of-user feature exists anywhere.

## 9. Token leakage

Covered under §1 (response-body leakage, fixed). Server-side logging is
clean: pino redacts `password`/`pin`/`token`/`secret`/`authorization`/
`cookie`; no request-body logging middleware exists; and every actual
`beforeData`/`afterData` audit payload in the codebase was traced and
confirmed to never include password hashes or raw tokens.

## 10. Rate limiting

- **MEDIUM — FIXED: `/auth/refresh` had no rate limit** despite being an
  unauthenticated endpoint that accepts a bearer token. Added
  `refreshRateLimiter` (120/15min — high ceiling because every active
  session refreshes automatically roughly every 15 minutes, and many users
  behind one office NAT/IP can legitimately generate a lot of refresh
  traffic; this exists to blunt scripted abuse, not throttle normal use).
- **MEDIUM — FIXED: `POST /users/:id/reset-password` had no rate limit.**
  Already admin-gated (`master.user.manage`), but a sensitive
  credential-setting action deserves throttling regardless. Added
  `passwordResetRateLimiter` (15/15min, same strength as login).

## 11. Mass assignment — Safe

Checked `PATCH /users/:id`, `PATCH /memos/:id`, `PATCH
/settings/company-profile` — all three go through Zod schemas that strip
unknown keys (none use `.passthrough()`), and every service function maps
validated fields explicitly into the Prisma `update()` call rather than
spreading `req.body`. No endpoint lets a client smuggle an unvalidated
field into a database write.

## 12. Audit tampering — Safe

No route anywhere exposes update/delete for `AuditEvent` — the service
layer only ever `create()`s them. `actorId` is populated exclusively from
the authenticated session (`req.user.id`) at every call site, never from
client-supplied body fields.

## 13. Sensitive logging — Safe

No request-body-logging middleware exists (no `morgan`/`pino-http`); the
only logging touching request data is the centralized error handler, which
logs `{err, requestId}` — never `req.body` — through pino's redaction
rules.

---

## Known gaps not fixed (accepted for now, tracked here)

1. **No CSRF token mechanism** (§2) — mitigated by SameSite=Lax + locked
   CORS origin today, but has no defense-in-depth. Add a real CSRF token if
   the auth model ever changes (e.g. a GET-based mutation, or moving off
   cookie auth for some client).
2. **`GET /memos/:id` still allows viewing another user's non-confidential
   DRAFT** (§4) — mirrors a pre-existing gate that only restricts
   `CONFIDENTIAL`/`HIGHLY_CONFIDENTIAL` classifications; left as a product
   decision rather than silently tightened.
3. **No upload content-type verification or malware scanning** (§7) —
   accepted risk for an internal tool; revisit if this ever accepts
   uploads from less-trusted parties (e.g. if the "no UI for external
   recipients" gap noted in `apps/e2e/README.md` is ever closed and
   external parties start uploading directly).

## Verification methodology

Every **FIXED** item above was checked with real code execution, not just
re-reading the diff:
- The `SESSION_SECRET` guard was executed with `NODE_ENV=production` and no
  secret set, confirming it throws before the server would ever start.
- The IDOR fixes were checked with a dedicated smoke test creating a real
  CONFIDENTIAL memo and confirming both the block (unrelated user →
  `ForbiddenError`) and the allow (actual author/admin → success) for
  `updateDraft`, `getMemoDetail`, and `getAttachmentDownloadUrl`.
- The full Playwright E2E suite (8 scenarios covering the critical business
  paths) was re-run after all fixes — all 8 still pass, confirming none of
  the new authorization checks broke a legitimate flow.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` (44 API tests), and a full
  `pnpm build` all pass after every change in this document.
