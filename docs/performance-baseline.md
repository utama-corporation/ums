# Performance Baseline

Real HTTP-level timing and query-plan checks against a running local
`@ums/api` dev server and local Postgres, measured 2026-08-20 — not
estimated or fabricated. Read the caveats before treating any number here
as a production guarantee.

## Important caveat: this is dev-scale data, not production scale

The local dev database has a handful of memos/users seeded — nowhere near
production volume. Every number below is genuinely measured, but a fast
number on 3 rows says nothing about behavior on 300,000 rows. Where it
matters (search, list), the query **plan** was checked directly (see
below) rather than relying on timing alone, since plan shape is what
actually predicts scaling behavior — a sequential scan that takes 0.05ms on
3 rows can take seconds on 3 million.

## Measured response times (local dev, warm cache, 20 sequential requests/endpoint)

| Endpoint | min | avg | p95 | max |
|---|---|---|---|---|
| `GET /memos?limit=20` | 6.3ms | 18.6ms | 173.5ms | 173.5ms |
| `GET /search?q=memo` | 6.3ms | 8.1ms | 12.5ms | 12.5ms |
| `GET /dashboard` | 8.0ms | 17.9ms | 79.6ms | 79.6ms |
| `GET /reports/status` | 4.2ms | 6.4ms | 12.1ms | 12.1ms |
| `GET /users?limit=20` | 6.9ms | 9.1ms | 12.1ms | 12.1ms |
| `GET /approvals/inbox` | 4.5ms | 6.2ms | 10.0ms | 10.0ms |

The occasional high outlier (`/memos` p95/max both 173.5ms, `/dashboard`
max 79.6ms) is most likely a Prisma connection-pool cold-start or a GC
pause on this shared dev machine, not a query problem — worth re-checking
if it reproduces consistently under real load, but a single outlier in 20
requests on a laptop running many other things isn't itself evidence of a
bug.

`memo.submit`/`approval.approve` (state-transition writes, not simple
reads) weren't isolated with the same harness — they were exercised
repeatedly and successfully as part of the E2E suite (`apps/e2e`, 8
scenarios each completing full multi-actor flows including these calls in
2-7 seconds total including real browser rendering and page navigation),
which is consistent with these not being a bottleneck, but that's weaker
evidence than a dedicated timing harness would give. Worth a follow-up if
these ever become a suspected hot path.

## Query plan check: full-text search

`searchService.ts` builds a `to_tsvector('simple', title || ' ' ||
memoNumber) @@ plainto_tsquery(...)` query. Checked with `EXPLAIN ANALYZE`
directly against the local DB:

```
Seq Scan on "Memo"  (cost=0.00..1.82 rows=1 width=16) (actual time=0.029..0.029 rows=1.00 loops=1)
  Filter: (to_tsvector(...) @@ '''memo'''::tsquery) OR (title ~~* '%memo%') OR ("memoNumber" ~~* '%memo%')
Execution Time: 0.051 ms
```

This shows a sequential scan, which looks alarming out of context — but a
matching **GIN index already exists**:

```
Memo_search_fts_idx : CREATE INDEX ... USING gin (to_tsvector('simple', COALESCE(title,'') || ' ' || COALESCE("memoNumber",'')))
```

Postgres's planner correctly chose a seq scan here because the table has 3
rows — for a table this small, scanning it directly is genuinely cheaper
than the overhead of using an index. **This is expected, correct planner
behavior, not a missing-index bug.** The index is real, matches the exact
expression used in the query (required for Postgres to consider it), and
will be used once the table is large enough for the planner to prefer it —
verify this by re-running the same `EXPLAIN ANALYZE` against a
production-sized (or synthetically bulk-loaded) dataset before launch, to
confirm the plan actually flips to an index/bitmap scan as expected. Not
done in this pass — would need a realistic bulk dataset to demonstrate,
which doesn't exist yet.

**One residual concern**: the `OR "title" ILIKE '%term%'` /
`"memoNumber" ILIKE '%term%'` clauses are leading-wildcard pattern matches,
which a standard B-tree index (or even `pg_trgm`) can't accelerate as well
as the GIN full-text index does — these exist as a fallback to catch
partial/substring matches the tokenizer might miss, which is a reasonable
design tradeoff, but means every search query still does *some* per-row
string scanning regardless of the GIN index's help on the tsvector half.
Not a blocker, but worth knowing if search ever becomes slow at scale —
the ILIKE fallback is the first thing to look at.

## Existing indexes relevant to the audited endpoints

Confirmed via `pg_indexes` (not assumed from the schema file — checked
what's actually in the database):

```
Memo_status_idx      : btree (status)        -- backs GET /memos filters, dashboard groupBy
Memo_categoryId_idx  : btree ("categoryId")
Memo_authorId_idx    : btree ("authorId")     -- backs "my memos" scoping
Memo_memoDate_idx    : btree ("memoDate")
Memo_search_fts_idx  : gin (to_tsvector(...)) -- backs full-text search, see above
```

These line up with the actual `WHERE`/`groupBy` clauses used in
`memoDraftService.ts`, `dashboardService.ts`, and `searchService.ts` — no
missing index was found for the query patterns actually exercised by the
audited endpoints.

## Realistic initial targets (not yet load-tested against)

Per the master prompt's own instruction not to fabricate results, these
are standard, defensible starting SLOs for an internal business
application — not numbers derived from this session's measurements (which
are dev-scale and therefore not predictive), and not yet validated under
production load or dataset size:

| Operation class | Target p95 | Rationale |
|---|---|---|
| Simple list/detail reads (memo list, user list, notification list) | < 300ms | Standard "feels instant" threshold for an internal tool; current dev numbers are far under this, leaving headroom for production data volume. |
| Search | < 500ms | Slightly more headroom given the ILIKE fallback's scaling risk noted above. |
| Dashboard (multiple aggregate queries) | < 800ms | Aggregates cost more; this is generous specifically because dashboard correctness matters more than snappiness here. |
| State-changing writes (submit, approve, publish) | < 1s | These involve transactions, audit logging, and sometimes S3/PDF generation (publish) — genuinely heavier, and users tolerate slightly more latency for an action with visible confirmation feedback. |

**These targets are not yet verified against production-scale data or
concurrent load** — that requires either real production traffic data or a
deliberate load-testing pass (e.g. seeding 100k+ memos and re-running this
same harness, or a tool like `autocannon`/`k6` for concurrent-request
behavior) which is out of scope for this session. Treat this table as the
starting bar to measure against once that's possible, not a claim that
it's already been met at scale.
