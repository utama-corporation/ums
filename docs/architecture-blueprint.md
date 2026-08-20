# Architecture Blueprint - Utama Memo System (UMS)

## 1. Bounded Contexts & Aggregate Modules

```
+-------------------------------------------------------------------------------+
|                             UTAMA MEMO SYSTEM (UMS)                           |
+-------------------+--------------------+------------------+-------------------+
|  IDENTITY & RBAC  |  MASTER DATA       | MEMO AUTHORING   | WORKFLOW ENGINE   |
|  - User           |  - Category        | - Memo           | - WorkflowDef     |
|  - Department     |  - MemoType        | - ContentVersion | - WorkflowInstance|
|  - Role           |  - NumberingRule   | - Attachment     | - Assignment      |
|  - Session        |  - CompProfile     | - Sender/Recip   | - Decision        |
+-------------------+--------------------+------------------+-------------------+
|  DISTRIBUTION     |  PUBLICATION & SEC | TASK DISPOSITION | NOTIF & COMPLIANCE|
|  - Distribution   |  - SignatureProf   | - Disposition    | - Notification    |
|  - ReadReceipt    |  - Publication     | - Task           | - OutboxEvent     |
|  - ExternalAccess |  - VerifToken      | - TaskEvidence   | - AuditEvent      |
+-------------------+--------------------+------------------+-------------------+
```

### Context Descriptions
1. **Identity & Access Management (IAM)**: Authenticates users, rotates sessions, enforces password policy, manages hierarchical departments and fine-grained permissions.
2. **Master Data & Settings**: Configures memo types, categories, company metadata, and concurrency-safe sequential numbering rules.
3. **Memo Authoring Aggregate**: Manages editable drafts, rich-text content versioning, sanitation, and file attachments.
4. **Workflow & Approval Engine**: Evaluates active workflow definitions, handles sequential/parallel step transitions, processes approvals, rejections, revisions, and delegations.
5. **Distribution & External Delivery**: Manages internal inbox delivery, department recipient snapshots, read receipt tracking, and high-entropy external token links.
6. **Publication & Signature Context**: Controls internal digital signature assets, PIN confirmation, canonical PDF rendering, cryptographic hashing (SHA-256), and public verification.
7. **Task Disposition Engine**: Converts approved memos into actionable tasks with assignees, deadlines, evidence uploads, and verification workflows.
8. **Notification, Reporting & Compliance**: Handles transactional outbox dispatching, email queues, full-text search indexing, reporting read-models, export jobs, and audit trail logs.

---

## 2. Conceptual ERD Entity Checklist

- `CompanyProfile`
- `User`, `UserCredential`, `Session`, `LoginAttempt`
- `Department`, `Role`, `Permission`, `UserRole`, `RolePermission`
- `UserDelegate`
- `Category`, `MemoType`, `MemoNumberingRule`, `MemoNumberSequence`
- `WorkflowDefinition`, `WorkflowDefinitionVersion`, `WorkflowStep`, `WorkflowCondition`, `WorkflowApproverRule`
- `Memo`, `MemoContentVersion`, `MemoSender`, `MemoRecipient`, `MemoCc`, `MemoRelation`
- `MemoStatusHistory`, `DraftAccessGrant`
- `AttachmentObject`, `MemoAttachment`
- `WorkflowInstance`, `WorkflowInstanceStep`, `ApprovalAssignment`, `ApprovalDecision`, `ApprovalComment`
- `MemoDistribution`, `DistributionRecipient`, `ReadReceipt`, `ExternalRecipientAccess`, `ExternalAccessEvent`
- `DigitalSignatureProfile`, `SignatureCredential`, `SignatureUsage`, `DocumentPublication`, `PublicationArtifact`, `DocumentVerificationToken`
- `MemoDisposition`, `Task`, `TaskAssignee`, `TaskStatusHistory`, `TaskEvidenceAttachment`, `TaskVerification`
- `Notification`, `NotificationPreference`, `EmailDelivery`
- `DomainOutboxEvent`, `ExportJob`
- `AuditEvent`, `SystemSetting`
