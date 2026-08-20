# Domain Glossary - Utama Memo System (UMS)

This document defines the core domain concepts, entities, status names, and technical terms used throughout the UMS application.

## 1. Memo Statuses (Kanonik Status Memo)
- **DRAFT**: Initial state of a memo. Mutable by creator. Not visible to approvers or recipients.
- **SUBMITTED**: Transition state when memo submission is accepted and workflow initialization begins.
- **WAITING_APPROVAL**: Active workflow state waiting for one or more assigned step approvers to take action.
- **REVISION**: Returned state requiring creator modification based on approver request.
- **REJECTED**: Workflow terminated negatively due to explicit rejection policy.
- **CANCELLED**: Aborted by author/authorized party before approval/publication. Cannot be reused.
- **APPROVED**: All mandatory workflow steps completed successfully.
- **OUTBOX**: Distributed to internal or external recipient party inboxes.
- **PUBLISHED**: Official immutable memo artifact generated (canonical PDF, SHA-256 fingerprint, verification token).
- **ARCHIVED**: Soft-stored for long-term retention policies.

## 2. Roles & Permissions
- **SUPER_ADMIN**: Full system configuration, tenant profiles, global RBAC management.
- **MEMO_ADMIN**: Workflow definitions, category management, memo oversight, reporting.
- **MANAGEMENT**: Executive capabilities (create, receive, approve, reject, publish).
- **DEPARTMENT_HEAD**: Departmental scope administration, approvals, task dispositions, oversight.
- **STAFF**: Standard internal creation, reading, and task execution.
- **APPROVER**: Designated actor in active workflow step (approve, reject, revision, delegate, sign).
- **AUDITOR**: Read-only compliance review of memos, approvals, and audit trails.
- **EXTERNAL_RECIPIENT**: Non-authenticated external recipient accessing designated documents via secure hashed token links.

## 3. Workflow & Approval Concepts
- **WorkflowDefinition**: Template outlining steps, rules, SLAs, and approval strategies. Versioned.
- **WorkflowInstance**: Runtime snapshot of a `WorkflowDefinitionVersion` bound to a specific memo at submit time.
- **Approver Strategy**: Method to resolve actual users for a step (`USER`, `ROLE`, `DEPARTMENT_HEAD`, `MANAGER_OF_REQUESTER`).
- **Parallel Mode**: Multi-approver step policy (`ALL`, `ANY`, `QUORUM`).
- **Approval Decision**: Append-only log of action taken by an approver (`APPROVE`, `REJECT`, `REQUEST_REVISION`, `DELEGATE`).
- **Delegation**: Temporary transfer of approval authority from a delegator to a delegate with explicit start/expiry dates and scope.

## 4. Distribution & Parties
- **Sender Party**: Authoring entity (User or Department).
- **Recipient Party**: Intended targets (`SINGLE_TO_SINGLE`, `SINGLE_TO_MULTI`, `MULTI_TO_SINGLE`, `MULTI_TO_MULTI`, `EXTERNAL`).
- **CC Party**: Carbon Copy informational recipients.
- **Read Receipt**: Tracking record storing `firstReadAt` and `lastViewedAt` timestamps per recipient.

## 5. Disposition & Task Management
- **Disposition**: Transposition of an approved/received memo into actionable tasks for specific internal PICs.
- **Task Status**: Lifecycle state of disposition task (`NOT_STARTED`, `IN_PROGRESS`, `WAITING_VERIFICATION`, `COMPLETED`, `OVERDUE`, `CANCELLED`).
- **Evidence Attachment**: File uploaded by assignee proving task completion.

## 6. Signature & Verification
- **InternalSignatureProvider**: Application-managed signature abstraction storing encrypted signature assets, PIN hashes, signing timestamps, IP, and document checksums.
- **Certified E-Signature (PSrE)**: Third-party legally binding PKI digital signature (future integration).
- **Verification Token**: Opaque token embedded in QR codes linking to public validation metadata.
