# ADR-002: Next.js App Router Frontend Architecture

## Status
Accepted

## Context
Master prompt specifies Next.js (React + TypeScript) as the primary frontend architecture choice over Vite, due to built-in enterprise capabilities for routing, layouts, server context, security headers, and middleware.

## Decision
We select Next.js (App Router, React 19 / Next.js 15+, TypeScript) as the official web frontend framework in `apps/web`.

Key conventions:
- Use Client Components for interactive UI components (forms, tables, wizard steps, rich text editor, preview drawers).
- Use Server Components where appropriate for layout shells and static containers.
- API requests must route through a unified, typed API client invoking `apps/api` via REST JSON endpoints.
- Authentic session state is maintained via HttpOnly cookies; browser code does not store tokens in `localStorage`.

## Consequences
- **Positive**: Enterprise-ready routing, layout nesting, SSR/SSG capabilities, consistent server-side security posture.
- **Negative**: Requires handling Next.js server/client component boundaries carefully with API requests.
