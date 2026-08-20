# ADR-003: Cookie-Based Authentication & CSRF Protection

## Status
Accepted

## Context
UMS handles confidential internal corporate memos, requiring strict token defense mechanisms. Storing access tokens in `localStorage` or `sessionStorage` exposes tokens to XSS attacks.

## Decision
1. **Tokens**: Auth sessions issue short-lived access tokens (15 mins) and long-lived refresh tokens (7 days).
2. **Storage**: Access and Refresh tokens are delivered via `HttpOnly`, `Secure`, `SameSite=Lax` (or `Strict`) cookies.
3. **Refresh Rotation**: Refresh token reuse triggers immediate invalidation of all active sessions for the compromised user account (token reuse detection). Refresh tokens are stored in the database in hashed form (Argon2id or SHA-256).
4. **CSRF Protection**: For mutating API endpoints (`POST`, `PUT`, `PATCH`, `DELETE`), double-submit CSRF protection or custom header verification (`X-Requested-With` / `X-CSRF-Token`) is required and enforced by API middleware.

## Consequences
- **Positive**: Complete defense against client-side script token theft via XSS. Automatic background session rotation.
- **Negative**: Requires careful CORS origin white-listing and credentials mode setup on client fetch wrappers.
