# ADR-006: Memo State Machine & State Transition Rules

## Status
Accepted

## Context
Memo states dictate allowed business operations, visibility, and immutability. Workflow state logic must be enforced strictly by backend domain services, preventing generic CRUD status modifications.

## Decision
1. **Canonical States**: `DRAFT`, `SUBMITTED`, `WAITING_APPROVAL`, `REVISION`, `REJECTED`, `CANCELLED`, `APPROVED`, `OUTBOX`, `PUBLISHED`, `ARCHIVED`.
2. **Transition Rules**:
   - `DRAFT` -> `SUBMITTED`
   - `SUBMITTED` -> `WAITING_APPROVAL` (or `APPROVED` if zero steps required)
   - `WAITING_APPROVAL` -> `APPROVED` | `REVISION` | `REJECTED` | `CANCELLED`
   - `REVISION` -> `DRAFT` (creates content version, resubmittable to `SUBMITTED`)
   - `REJECTED` -> `DRAFT` (or terminal `CANCELLED` per business policy)
   - `APPROVED` -> `OUTBOX` | `PUBLISHED`
   - `OUTBOX` -> `PUBLISHED` | `ARCHIVED`
   - `PUBLISHED` -> `ARCHIVED`
3. **Command Endpoints**: State transitions occur solely through explicit domain endpoints (`/submit`, `/approve`, `/reject`, `/request-revision`, `/distribute`, `/publish`, `/archive`). Direct mutation of `memo.status` via generic `PATCH /memos/:id` is strictly forbidden.

## Consequences
- **Positive**: Strict domain control, zero invalid state transitions, clean audit history generation.
- **Negative**: Requires custom command handlers and explicit domain permission checks for each transition endpoint.
