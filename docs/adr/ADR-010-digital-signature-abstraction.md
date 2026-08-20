# ADR-010: Digital Signature Abstraction vs Certified E-Signature (PSrE)

## Status
Accepted

## Context
The PRD requires signature asset embedding, PIN authentication, IP/timestamp logging, and QR validation. We need to distinguish internal application approval signing from certified electronic signatures (PSrE).

## Decision
1. **Signature Provider Abstraction**: We define an interface `DigitalSignatureProvider` with two implementations:
   - `InternalSignatureProvider`: MVP default. Handles stored user signature assets (encrypted at rest), PIN hash verification, timestamping, IP logging, SHA-256 document hashing, and internal QR verification tokens.
   - `CertifiedSignatureProvider`: Stub interface for external certified PKI providers (e.g., Privy, Peruri, VIDA).
2. **PIN Protection**: PINs are hashed using Argon2id with high memory cost. Verification requires explicit user PIN confirmation before applying signature assets to a document.
3. **QR Verification**: Public verification tokens link to `/verify/:token`, returning non-confidential metadata: Document Number, Publication Date, Signer Name/Role, Issuer, and SHA-256 Hash status.

## Consequences
- **Positive**: Clean abstraction allowing smooth upgrade to certified e-signatures without breaking business logic.
- **Negative**: Explicitly documented as non-PSrE internal signature for MVP compliance transparency.
