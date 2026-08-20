# ADR-004: PostgreSQL & Prisma ORM Data Access Strategy

## Status
Accepted

## Context
UMS requires strong relational integrity, transactional guarantees, complex filtering, audit trails, and concurrency control for sequential memo numbering and workflow state transitions.

## Decision
1. **Database**: PostgreSQL 16+ as the relational database engine. PostgreSQL full-text search (`pg_trgm` and `tsvector`) will be used for initial search requirements.
2. **ORM & Migrations**: Prisma ORM in `packages/db`.
3. **Primary Keys**: UUID (v4/v7) for external references; sequential integers only for human-facing sequence counters.
4. **Transactions & Locks**: Domain commands modifying memo state, incrementing sequential numbering, or submitting approvals MUST execute inside Prisma database transactions with explicit advisory locks or row-level `SELECT ... FOR UPDATE` (via raw Prisma queries when needed) to prevent race conditions.
5. **Soft Delete**: Applied strictly to entities requiring soft recovery (`Draft`, `User`, `Department`, `Category`). Immutable records (`ApprovalDecision`, `AuditEvent`, `DocumentPublication`) NEVER use soft deletes.

## Consequences
- **Positive**: Strict type safety generated directly from schema; declarative migrations; strong transactional isolation.
- **Negative**: Concurrency-critical locks (e.g., sequence generator) require careful Prisma raw SQL transaction blocks.
