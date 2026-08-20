# ADR-001: Monorepo Architecture & Package Boundaries

## Status
Accepted

## Context
Utama Memo System (UMS) comprises multiple runtime services (Express API backend, Next.js frontend, BullMQ background worker) and shared assets (Database schema, Zod API contracts, Environment configurations, Linting & TypeScript configs). We need a unified project structure that maximizes code sharing, type safety, and maintainable boundaries.

## Decision
We adopt a monorepo structure managed by `pnpm workspaces` and orchestrated by `Turborepo`.

Workspace Structure:
- `apps/api`: Express.js TypeScript REST API.
- `apps/web`: Next.js App Router TypeScript frontend.
- `apps/worker`: BullMQ background job processing worker.
- `packages/db`: Prisma schema, Prisma client export, migrations, and seed scripts.
- `packages/contracts`: Pure Zod schemas, API request/response DTO types (zero DB or runtime service dependencies).
- `packages/config`: Typed environment validation wrappers.
- `packages/tsconfig`: Shared TypeScript base configurations.
- `packages/eslint-config`: Shared ESLint configurations.

## Consequences
- **Positive**: End-to-end full-stack TypeScript type safety. Changes to Zod schemas in `packages/contracts` immediately flag type errors across both API and Web apps. Single git repository for unified versioning.
- **Negative**: Requires pnpm installation and Turborepo caching setup in CI.
