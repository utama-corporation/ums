# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base
RUN corepack enable
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS pruner
COPY . .
RUN npx turbo prune @ums/worker --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=installer /app .
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo build --filter=@ums/worker...

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 workeruser
COPY --from=builder --chown=workeruser:nodejs /app .
USER workeruser
CMD ["node", "apps/worker/dist/index.js"]
