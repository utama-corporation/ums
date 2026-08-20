# ADR-009: Published Memo Immutability & Canonical PDF Hashing

## Status
Accepted

## Context
Published memos carry corporate authority and legal significance. Once published, contents, attachments, recipients, and signatures must be permanently immutable.

## Decision
1. **Publication Action**: Publishing triggers generation of a canonical PDF document incorporating memo metadata, rich content, recipient list, approval history, and digital signatures.
2. **Cryptographic Fingerprint**: The generated PDF binary is hashed using SHA-256. The hash, storage object key, publication timestamp, and author metadata are recorded in `DocumentPublication`.
3. **Immutability Enforcement**: `PUBLISHED` memos reject any content updates, attachment modifications, or deletions at both backend API and database trigger/service levels.
4. **Revision Linking**: If a published memo requires changes, a new memo must be created with a `revisesMemoId` parent relation linking back to the original published memo (`revisesMemoId`).

## Consequences
- **Positive**: Complete audit compliance and non-repudiation of published documents.
- **Negative**: Fixes to published typos require issuing an explicit revision memo.
