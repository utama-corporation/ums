# STRIDE Threat Model - Utama Memo System (UMS)

| Threat Category | Target Module / Boundary | Potential Vulnerability | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Authentication & Session | Session hijacking, stolen access tokens, credential stuffing | HttpOnly Secure SameSite cookies, short access token expiry (15m), refresh token rotation with theft detection, IP/User-Agent rate limiting. |
| **Tampering** | Memo Draft & Content | XSS injections via rich text editor, parameter tampering in state | Server-side HTML sanitization allow-list (DOMPurify/sanitize-html), backend state machine validation, optimistic concurrency control (`lockVersion`). |
| **Tampering** | Published Memos & Attachments | Altering published memo PDFs or deleting attachments post-approval | SHA-256 canonical PDF fingerprint stored at publish time, strict immutability checks on published memo endpoints, S3 WORM/retention policies. |
| **Repudiation** | Approval & Digital Signature | Approver denying having approved or signed a critical memo | Append-only `ApprovalDecision` logs, PIN re-authentication before signing, cryptographic audit trail logging IP, timestamp, user ID, and document hash. |
| **Information Disclosure** | External Access & IDOR | Unauthorized user guessing memo IDs or accessing confidential memos | High-entropy random hashes for external tokens, server-side resource scope checks (`Self`/`Department`/`All`), strict `404`/`403` error masking to prevent ID enumeration. |
| **Information Disclosure** | Application Logs & Audit | Sensitive user passwords, PINs, or tokens printed in server logs | Structured JSON logging with strict key redaction (`password`, `pin`, `token`, `secret`, `signatureBinary`). |
| **Denial of Service** | File Storage & Search | Large file upload flooding, expensive un-indexed DB queries | Strict upload MIME/size limits (25MB max), presigned URL authorization, PostgreSQL partial indexing, API rate limiting, cursor-based pagination. |
| **Elevation of Privilege** | RBAC Authorization | Non-admin invoking administrative or approval commands | Dual-layer authorization: (1) Permission-based middleware check (`requirePermission`), and (2) Resource scope evaluation on service layer. |
