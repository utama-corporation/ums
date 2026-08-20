# ADR-007: Transactional Outbox Pattern & BullMQ Queue Integration

## Status
Accepted

## Context
Async tasks such as sending notification emails, processing SLA reminders, generating canonical PDFs, and exporting background reports must not block HTTP request-response cycles. Furthermore, network or worker failures during external services must not cause data inconsistency.

## Decision
1. **Transactional Outbox**: During business transactions (e.g. submitting approval or publishing), domain outbox events (`DomainOutboxEvent`) are written to the primary PostgreSQL database within the same database transaction.
2. **Worker Polling & BullMQ Dispatch**: A light background process or BullMQ producer reads pending outbox events from PostgreSQL and enqueues jobs into BullMQ (backed by Redis).
3. **Idempotent Workers**: `apps/worker` consumes BullMQ queues (`email-queue`, `pdf-queue`, `export-queue`, `reminder-queue`). Each worker handler uses an idempotency key (e.g., `outboxEventId`) to prevent duplicate processing.
4. **Retry & Backoff**: Exponential backoff (e.g. 3 retries with 5s, 30s, 5m delays) and Dead Letter Queue (DLQ) logging for permanent failures.

## Consequences
- **Positive**: Guaranteed message delivery without distributed 2PC transactions. High HTTP throughput.
- **Negative**: Adds Redis and BullMQ infrastructure dependencies.
