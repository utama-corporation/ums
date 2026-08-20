# Utama Memo System (UMS)

Utama Memo System is an enterprise web application for managing the complete lifecycle of internal corporate memos—creation, review, approval, distribution, task disposition, publication, and long-term archiving.

## Architecture Stack
- **Monorepo**: pnpm Workspaces + Turborepo
- **Backend API**: Express.js, TypeScript (Strict Mode)
- **Frontend App**: Next.js App Router, React 19, TypeScript
- **Background Worker**: BullMQ + Redis
- **Database**: PostgreSQL 16 + Prisma ORM
- **Object Storage**: S3-compatible (MinIO for dev)
- **Email Server**: Mailpit for local dev, SMTP for production

## Monorepo Layout
```
├── apps/
│   ├── api/          # Express.js REST API
│   ├── web/          # Next.js App Router Web UI
│   └── worker/       # BullMQ Background Job Worker
├── packages/
│   ├── config/       # Environment validation logic
│   ├── contracts/    # Zod schemas & API DTO contracts
│   ├── db/           # Prisma schema, migrations & seeders
│   ├── tsconfig/     # Shared TypeScript configurations
│   └── eslint-config/ # Shared ESLint rules
├── infra/
│   └── docker/       # Docker Compose setup for Postgres, Redis, MinIO, Mailpit
└── docs/             # ADRs, tracebility matrix, architecture blueprints
```

## Quick Start (Development)

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```

2. **Copy Environment Variables**:
   ```bash
   cp .env.example .env
   ```

3. **Start Development Infrastructure (Postgres, Redis, MinIO, Mailpit)**:
   ```bash
   docker compose -f infra/docker/docker-compose.yml up -d
   ```

4. **Run Database Migrations & Seed**:
   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

5. **Start Development Servers**:
   ```bash
   pnpm dev
   ```

## Development Quality Checks
- `pnpm lint`: Run ESLint across all workspaces.
- `pnpm typecheck`: Run TypeScript compiler checks.
- `pnpm test`: Run unit and integration tests with Vitest.
- `pnpm build`: Verify production builds.
