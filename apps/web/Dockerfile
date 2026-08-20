# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS pruner
COPY . .
RUN npx turbo prune @ums/web --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

FROM base AS builder
ARG NEXT_PUBLIC_API_URL
ENV API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=installer /app .
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo build --filter=@ums/web...

# ---- Runtime: Next.js standalone output only -------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=5000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 webuser
COPY --from=builder --chown=webuser:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=webuser:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=webuser:nodejs /app/apps/web/public ./apps/web/public
USER webuser
EXPOSE 5000
CMD ["node", "apps/web/server.js"]
