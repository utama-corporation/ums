# System & Architecture Diagrams - Utama Memo System (UMS)

## 1. System Context Diagram
```mermaid
graph TD
    User["Internal Staff / Management / Admin"] -->|HTTP / Web UI| UMS["Utama Memo System (UMS)"]
    ExtUser["External Recipient"] -->|Token Link Access| UMS
    UMS -->|Store Metadata & State| PostgresDB[("PostgreSQL 16 Database")]
    UMS -->|Async Queues & Cache| RedisDB[("Redis Server")]
    UMS -->|Store Attachment Binaries| ObjectStorage[("S3 Storage / MinIO")]
    UMS -->|Send Notifications| SMTP[("SMTP Server / Mailpit")]
```

## 2. Container Architecture Diagram
```mermaid
graph TD
    subgraph Web Container
        NextApp["Next.js App Router (apps/web)"]
    end

    subgraph API Container
        ExpressAPI["Express.js REST API (apps/api)"]
        AuthMiddleware["Auth & Scope Middleware"]
        DomainServices["Domain Services (Memo, Workflow, Task)"]
        ExpressAPI --> AuthMiddleware --> DomainServices
    end

    subgraph Background Worker Container
        BullMQWorker["BullMQ Worker (apps/worker)"]
    end

    NextApp -->|REST API / Cookie Session| ExpressAPI
    DomainServices -->|ORM Queries| PostgresDB[("PostgreSQL 16")]
    DomainServices -->|Write Outbox Events| PostgresDB
    DomainServices -->|Presigned URLs| ObjectStorage[("MinIO / AWS S3")]
    BullMQWorker -->|Fetch Jobs| Redis[("Redis")]
    BullMQWorker -->|Send Emails| SMTP[("Mailpit / SMTP")]
```

## 3. Memo Lifecycle State Diagram
```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> SUBMITTED: Submit Command
    SUBMITTED --> WAITING_APPROVAL: Workflow Active
    SUBMITTED --> APPROVED: Zero Approvers Required
    WAITING_APPROVAL --> APPROVED: All Steps Approved
    WAITING_APPROVAL --> REVISION: Revision Requested
    WAITING_APPROVAL --> REJECTED: Step Rejected
    WAITING_APPROVAL --> CANCELLED: Cancel Command
    REVISION --> DRAFT: Edit Content Version
    REJECTED --> DRAFT: Edit / Re-submit
    APPROVED --> OUTBOX: Distribute Command
    APPROVED --> PUBLISHED: Direct Publish
    OUTBOX --> PUBLISHED: Publish Command
    OUTBOX --> ARCHIVED: Archive Command
    PUBLISHED --> ARCHIVED: Retention Policy
    ARCHIVED --> [*]
```

## 4. Submit & Approval Sequence Diagram
```mermaid
sequenceDiagram
    autonumber
    actor Staff as Staff / Author
    participant API as Express API
    participant DB as PostgreSQL
    participant Worker as BullMQ Worker

    Staff->>API: POST /api/v1/memos/:id/submit (Idempotency-Key)
    API->>DB: Begin DB Transaction
    API->>DB: Lock Memo Row (FOR UPDATE)
    API->>DB: Validate Status (DRAFT -> SUBMITTED)
    API->>DB: Resolve Active Workflow Snapshot & Approvers
    API->>DB: Create WorkflowInstance & WorkflowInstanceSteps
    API->>DB: Update Status to WAITING_APPROVAL
    API->>DB: Write DomainOutboxEvent (MEMO_SUBMITTED)
    API->>DB: Commit Transaction
    API-->>Staff: 200 OK (Submitted successfully)

    Worker->>DB: Poll / Consume Outbox Event
    Worker->>Worker: Dispatch Email Notification to Step 1 Approver
```

## 5. Publish Sequence Diagram
```mermaid
sequenceDiagram
    autonumber
    actor Admin as Management / Memo Admin
    participant API as Express API
    participant DB as PostgreSQL
    participant S3 as S3 / MinIO Storage

    Admin->>API: POST /api/v1/memos/:id/publish (PIN / Auth verification)
    API->>DB: Verify User PIN & Authority
    API->>API: Render Canonical PDF & Embed Digital Signature & QR
    API->>API: Calculate SHA-256 PDF Hash
    API->>S3: Upload Canonical PDF Binary
    API->>DB: Begin Transaction
    API->>DB: Record DocumentPublication (Hash, S3 Key, VerificationToken)
    API->>DB: Update Memo Status to PUBLISHED (Immutable)
    API->>DB: Write AuditEvent (MEMO_PUBLISHED)
    API->>DB: Commit Transaction
    API-->>Admin: 200 OK (Published & Canonical PDF Ready)
```

## 6. Notification Outbox Sequence Diagram
```mermaid
sequenceDiagram
    autonumber
    participant Service as Domain Service
    participant Outbox as DomainOutboxEvent (DB)
    participant Dispatcher as Outbox Poller / Producer
    participant Redis as Redis Queue
    participant Worker as BullMQ Worker
    participant SMTP as Mailpit / SMTP

    Service->>Outbox: INSERT DomainOutboxEvent (STATUS=PENDING) in DB Tx
    Note over Service, Outbox: Transaction committed safely
    Dispatcher->>Outbox: SELECT PENDING events (FOR UPDATE SKIP LOCKED)
    Dispatcher->>Redis: Enqueue BullMQ Job (IdempotencyKey=EventId)
    Dispatcher->>Outbox: UPDATE STATUS=ENQUEUED
    Worker->>Redis: Pop Job from Queue
    Worker->>SMTP: Send HTML Email
    Worker->>Outbox: UPDATE STATUS=PROCESSED
```
