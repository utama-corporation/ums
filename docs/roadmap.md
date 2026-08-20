# Implementation Roadmap & Phase Acceptance Criteria

| Phase | Name | Main Deliverables | Verification Gate |
| :--- | :--- | :--- | :--- |
| **01** | Discovery, ADR, Blueprint | Requirements traceability, domain glossary, 10 ADRs, Mermaid diagrams, ERD, Threat model, Implementation state file. | Design review complete, zero state contradictions, baseline docs checked. |
| **02** | Foundation Monorepo & Infra | pnpm workspace setup (`apps/api`, `apps/web`, `apps/worker`, `packages/*`), Docker Compose (Postgres, Redis, MinIO, Mailpit), health endpoints, basic layout shell. | Lint, typecheck, test, build scripts pass; Docker containers healthy. |
| **03** | Identity, Session, RBAC, Department | Auth domain, session rotation, Argon2id, RBAC middleware, User & Dept CRUD, Audit logger, Protected frontend shell. | Auth unit & integration tests pass; role/scope permission enforcement verified. |
| **04** | Master Data & Workflow Designer | Category, MemoType, Numbering Rules, WorkflowDefinition versioning, Workflow Step designer UI & API. | Concurrency lock numbering test pass; workflow cycle validator unit tests pass. |
| **05** | Memo Draft, Recipient, Attachment | Memo draft aggregate, rich text sanitizer, recipient selector, autosave, S3 presigned attachment lifecycle. | Draft conflict test pass; XSS sanitation test pass; attachment presigned URL test pass. |
| **06** | Runtime Workflow & Approval Engine | Submit transaction, runtime approval engine, sequential/parallel steps, approve/reject/revision commands, UI approval inbox. | State transition matrix test pass; concurrent approver race test pass. |
| **07** | Distribution, Read Receipt, External | Distribution engine, internal inbox/outbox, department snapshot, read receipt, external token access page. | Department snapshot test pass; external token hash/expiry test pass. |
| **08** | Publish, Canonical PDF, Signature | Signature abstraction, PIN confirmation, PDF renderer, SHA-256 fingerprint, QR verification page, revision link flow. | Cryptographic PDF hash verification test pass; immutability check test pass. |
| **09** | Disposition & My Tasks | Task disposition, assignees, progress state transitions, evidence attachment, verification workflow, My Tasks UI. | Task state transition test pass; evidence authorization test pass. |
| **10** | Dashboard, Search, Report, Export | Dashboard read-model, PostgreSQL full-text search, reporting API, background BullMQ export job (CSV/XLSX/PDF). | EXPLAIN query plan verified; export job authorization & expiring URL test pass. |
| **11** | Notifications, Settings, Operations | Notification center, template engine, settings management, operational runbooks, queue health & readiness. | Email delivery outbox integration test pass; operational runbooks complete. |
| **12** | Hardening, E2E, Release Readiness | End-to-end Playwright tests, OWASP ASVS audit, WCAG accessibility check, clean DB migration test, release checklist. | All automated tests pass (100% clean); zero TypeScript/lint errors; build passes. |
