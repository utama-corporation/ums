# syntax=docker/dockerfile:1

# ---- Base ---------------------------------------------------------------
FROM node:20-bookworm-slim AS base
RUN corepack enable
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- Prune: reduce the monorepo to only what @ums/api needs --------------
FROM base AS pruner
COPY . .
RUN npx turbo prune @ums/api --docker

# ---- Install: install deps for the pruned workspace -----------------------
FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# ---- Build: bring in full source, then compile ----------------------------
FROM base AS builder
COPY --from=installer /app .
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo build --filter=@ums/api...

# ---- Runtime ---------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 apiuser
COPY --from=builder --chown=apiuser:nodejs /app .
USER apiuser
EXPOSE 5500
CMD ["node", "apps/api/dist/server.js"]
