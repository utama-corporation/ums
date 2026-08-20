# Business & Product Decision Log

This document records business, legal, and operational decisions required before production release, along with development defaults.

## 1. BLOCKING DECISIONS (Required Before Production Release)

1. **Digital Signature Compliance**:
   - *Question*: Is an internal application signature (encrypted asset + PIN verification) legally sufficient for corporate policy, or is a certified electronic signature provider (PSrE / Privy / Peruri) required?
   - *Development Assumption*: Implement `InternalSignatureProvider` abstraction for MVP.

2. **Retention Policy & Legal Hold**:
   - *Question*: How long must published memos, audit trails, and file attachments be retained before archival or legal purge?
   - *Development Assumption*: Indefinite retention for published memos and audit events; 90 days for temporary export files.

3. **External Access Policy for Confidential Documents**:
   - *Question*: May memos classified as `CONFIDENTIAL` or `HIGHLY_CONFIDENTIAL` be delivered to external recipients?
   - *Development Assumption*: By default, external token delivery is blocked for `CONFIDENTIAL` and `HIGHLY_CONFIDENTIAL` memos unless explicitly authorized by a custom policy override.

---

## 2. NON-BLOCKING DECISIONS (Development Defaults Configured)

1. **Final Memo Numbering Timing**:
   - *Default*: Memo sequence numbers are allocated atomically upon reaching `APPROVED` or `PUBLISHED` state.

2. **Parallel Step Completion Policy**:
   - *Default*: Configurable per workflow step (`ALL` approvers required by default).

3. **Department Recipient Scope**:
   - *Default*: Recipients are snapshotted to active department user members at distribution time.

4. **Task PIC Assignment**:
   - *Default*: Tasks support multiple internal assignees (PICs) with mandatory completion verification by disposition issuer.
