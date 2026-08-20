# Deployment Guide (Docker, single-server)

Target: an Ubuntu server with Docker already installed (verified: `docker --version`
→ 29.7.2). Everything — PostgreSQL, Redis, MinIO, Mailpit, and the three app
services (`api`, `web`, `worker`) — runs as containers via `docker-compose.prod.yml`
at the repo root.

## Why you can't just zip and copy

- `node_modules` here is ~665MB and contains **Windows** native binaries
  (Prisma's query engine in particular). It will not run on Linux — it must be
  reinstalled on the target so `prisma generate` produces the Linux engine.
- There is no app container image yet on the Windows side to copy — the
  Dockerfiles build them fresh from source.
- The dev `.env` has dev-only secrets and points at things that only exist on
  this Windows machine (`S3_ENDPOINT=http://192.168.10.45:9000`, etc.). None of
  that is valid on the server.

So: transfer **source code only** (ideally via git), then build the Docker
images on the server itself.

## 1. Get the code onto the server

Preferred — push to a git remote (GitHub/GitLab/self-hosted) and clone on the
server:

```bash
git clone <your-repo-url> ums && cd ums
```

If you have no git remote yet, the next-best option is `rsync`/`scp` the
source **excluding** build artifacts:

```bash
rsync -avz --exclude node_modules --exclude .next --exclude dist --exclude .turbo \
  ./ khalid@dev:~/ums/
```

Do not send a plain zip of the whole folder — it'll carry the 665MB of
Windows-only `node_modules` for nothing.

## 2. Configure secrets

```bash
cp .env.production.example .env.production
```

Edit `.env.production` and replace every `CHANGE_ME`. Generate strong secrets with:

```bash
openssl rand -hex 32
```

At minimum you must set: `POSTGRES_PASSWORD`, `SESSION_SECRET`, `CSRF_SECRET`,
`S3_ACCESS_KEY`, `S3_SECRET_KEY`. Update `APP_URL` / `API_URL` /
`NEXT_PUBLIC_API_URL` once you know the server's real address (IP or domain) —
`APP_URL` in particular must match exactly what the browser uses, or
cookie/CORS checks will reject logins.

**Never commit `.env.production`** — it's already excluded in `.gitignore`.

## 3. Build and start the stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This builds the `api`, `web`, and `worker` images from source (multi-stage
Dockerfiles, so the final images don't carry build tooling), starts Postgres/
Redis/MinIO/Mailpit, runs database migrations once via the `migrate` service,
creates the MinIO bucket via `minio-init`, and only then starts `api`/`worker`
(they wait on `migrate` succeeding via `depends_on: condition:
service_completed_successfully`).

First build will take a few minutes (pnpm install + turbo build inside
containers). Watch it with:

```bash
docker compose -f docker-compose.prod.yml logs -f
```

## 4. Verify

```bash
curl http://localhost:5500/api/v1/ready   # {"status":"ready","database":"connected",...}
curl -I http://localhost:5000/            # 200/307
```

## 5. Seed initial accounts (optional, manual — do this deliberately)

The seed script creates dev-style accounts with a **known password**
(`Password123!`). Do not run this unmodified against a real production
userbase. For a first deployment / staging use:

```bash
docker compose -f docker-compose.prod.yml run --rm api \
  node_modules/.bin/tsx packages/db/src/seed.ts
```

Then log in once as `admin` and change the password (or better: edit
`packages/db/src/seed.ts` to require real passwords per environment before
running this on anything user-facing).

## 6. Put it behind a real domain + TLS

The compose file exposes `web` on `:5000` and `api` on `:5500` directly. For
anything beyond local testing, put a reverse proxy (Caddy or nginx) in front
handling TLS termination, and proxy:

- `/` → `web:5000`
- `/api` → `api:5500`

Caddy is the least config for this (automatic HTTPS via Let's Encrypt):

```caddyfile
your-domain.example {
    handle /api/* {
        reverse_proxy localhost:5500
    }
    handle {
        reverse_proxy localhost:5000
    }
}
```

Update `APP_URL`/`API_URL`/`NEXT_PUBLIC_API_URL` in `.env.production` to the
real `https://your-domain.example` origin, then `docker compose -f
docker-compose.prod.yml up -d --build` again (web needs a rebuild since
`NEXT_PUBLIC_API_URL` is baked in at build time).

## Known limitations to be aware of before real production traffic

- **Email is not wired to a real SMTP relay by default.** Mailpit is a dev
  mail catcher — it never leaves the box. Set `SMTP_USER`/`SMTP_PASS` and swap
  `SMTP_HOST` in `.env.production`/compose to a real provider before relying on
  email notifications.
- **BullMQ/Redis are running but currently unused.** The worker polls the
  outbox table directly every 5s instead of using the queue (a pre-existing
  gap noted earlier in this project, not something this deploy setup changes).
  Redis is still started because `bullmq`/`ioredis` are already dependencies
  and future work is expected to wire it up.
- **Backups are your responsibility.** `postgres_data`, `minio_data`, and
  `redis_data` are named Docker volumes — back them up on whatever schedule
  matches your data's value (`docker run --rm -v ums_postgres_data:/data ...`
  or `pg_dump` from inside the `postgres` container). Nothing here automates
  that yet.
- **This is a single-box deployment.** No horizontal scaling, no managed DB.
  Fine for an internal tool at moderate load; revisit before it needs to
  survive that one Ubuntu box going down.

## Redeploying after code changes

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Compose rebuilds only the images whose build context changed and restarts
just those containers; `migrate` re-runs (a no-op if there's nothing new to
apply) before `api`/`worker` restart.
