# Accessibility & Responsive Review

Automated, evidence-based review using `@axe-core/playwright` (WCAG2A/AA
ruleset) against real rendered pages, plus a horizontal-overflow check at
mobile viewport width (375px). This is not a manual/subjective pass — every
finding below was produced by actually running the pages through axe, not
inspected by eye. The suite lives at
`apps/e2e/tests/accessibility-audit.spec.ts` and runs as part of
`pnpm test:e2e`, so regressions on the fixed issues get caught automatically
going forward.

## Pages audited

Public: `/login`. Authenticated (as `admin`, to reach every nav-gated
page): `/dashboard`, `/memos/inbox`, `/memos/new`, `/master/users`,
`/master/workflows`, `/settings`, `/reports`, `/tasks/assigned`.

## What was found and fixed

**`select-name` / `label` (critical/serious) — FIXED.** The `/memos/new`
form had 5 `<select>` elements and 2 text inputs with visually-adjacent
`<label>` text that wasn't programmatically associated (no `htmlFor`/`id`,
no wrapping) — invisible to screen readers, which would announce these
fields with no name at all ("combo box, blank" instead of "Kategori,
combo box"). Same issue found and fixed across 12 fields in
`apps/web/src/app/settings/page.tsx` (company profile, security policy,
SMTP config, email template editor).

**Fix**: added `id`/`htmlFor` pairs to every affected `<label>`/`<input>`/
`<select>`/`<textarea>` in both files. Zero visual change — this is a pure
markup-correctness fix. Re-ran the audit after the fix: **0** `label`/
`select-name` violations remain on any of the 9 audited pages (verified via
a second and third full audit run — not a one-off).

This fix also let `apps/e2e/tests/helpers.ts`'s `uiCreateAndSubmitMemo`
switch from a brittle `label:has-text(...) + select` sibling-selector
workaround to the standard, robust `page.getByLabel(...)` — the same
accessibility fix improved test maintainability for free.

## What was found and NOT fixed (documented, deliberate)

**`color-contrast` (serious) — present on all 9 pages, not fixed this
pass.** The brand primary color `ums-red` (`#ed1c24`,
`apps/web/tailwind.config.js:21`) on white text is **4.38:1**, just under
the WCAG AA-required **4.5:1** for normal-weight/sub-large text (verified
directly: axe reports "Element has insufficient color contrast of 4.38...
Expected contrast ratio of 4.5:1" on the primary "Login"/"Simpan"/etc.
buttons). This single color is used across the entire application (21
files use `ums-red` for primary action buttons, active nav states, and
error text) — it's the brand's primary color, not an isolated CSS bug.

**Why not fixed here**: changing the brand's primary red is a design-system
decision, not a code defect to patch silently in a hardening pass — the
gap is small (4.38 vs. 4.5 needed) and likely closeable with a slightly
darker shade (e.g. something in the `#d0161d`–`#d91720` range would very
plausibly clear 4.5:1, but this needs an actual contrast-checker pass
against the final chosen shade, not a guess baked into code). Tracked here
as an explicit, measured gap — the audit test (`accessibility-audit.spec.ts`)
currently excludes `color-contrast` from its failure gate so this doesn't
block the suite, but leaves every other rule enforced.

**`/master/workflows` and `/master/users`/`/dashboard` show a higher
color-contrast node count than other pages (7-22 elements)** — these pages
render more badges/status pills using the same or adjacent brand colors
(e.g. status badges), so the same root-cause color choice compounds where
more colored UI elements appear on screen. Not a separate bug, same fix
would resolve all instances.

## Responsive layout

Checked 5 representative pages (`/login`, `/dashboard`, `/memos/new`,
`/master/users`, `/master/workflows`) at a 375×667 mobile viewport for
horizontal overflow (`document.documentElement.scrollWidth >
clientWidth`). **No overflow found on any page** — `scrollWidth` matched
the viewport width exactly (375px) in every case. The layout classes
(Tailwind responsive grid breakpoints already used throughout, e.g.
`md:grid-cols-3`) are working as intended at mobile width for these pages.

Not exhaustively checked: every page in the app, or tablet-width
breakpoints specifically — this was a representative sample of the
highest-traffic pages (login, dashboard, the two most complex forms), not
a page-by-page sweep.

## Running this yourself

```bash
cd apps/e2e
npx playwright test accessibility-audit.spec.ts
```

Prints a full violation summary (grouped by severity) at the end of the
run regardless of pass/fail, so `moderate`/`minor` issues (not covered
above, since none were found at critical/serious severity beyond
color-contrast) stay visible without needing to fail the build over them.
