# ADR-008: File Attachment Lifecycle & S3 Storage Abstraction

## Status
Accepted

## Context
Memos include file attachments (PDF, DOCX, XLSX, images). Raw file binary data must be kept out of PostgreSQL to maintain small database size and fast backup/restore operations, while attachment access must be strictly authorized.

## Decision
1. **Metadata vs Binary**: File metadata (name, size, MIME type, SHA-256 checksum, upload status) is stored in PostgreSQL (`AttachmentObject` and `MemoAttachment`). File binaries are stored in S3-compatible object storage (MinIO for dev, AWS S3 / MinIO for prod).
2. **Presigned Upload Workflow**:
   - Client requests upload via `POST /memos/:id/attachments/initiate`.
   - Backend checks file extension, MIME allow-list, max size limit (e.g. 25MB), creates `AttachmentObject` in `PENDING` state, and returns presigned S3 PUT URL.
   - Client uploads binary directly to S3.
   - Client calls `POST /attachments/:id/complete` with client-calculated SHA-256 hash. Backend marks attachment `READY` after verifying presence in S3.
3. **Controlled Streaming / Presigned Downloads**: Download links are authorized, short-lived presigned URLs or backend-proxied streams enforcing resource access scope.
4. **Antivirus Integration**: Storage architecture includes a `QUARANTINED` status hook for virus scanner background checks before marking file status `READY`.

## Consequences
- **Positive**: Offloads file binary payload handling from API server; prevents database bloat; secure pre-signed authorization.
- **Negative**: Client requires 2-step upload interaction (initiate -> upload -> complete).
