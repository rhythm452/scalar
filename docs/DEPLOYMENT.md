# DEPLOYMENT

This document covers local development, Vercel frontend deploy, Fly.io backend deploy, environment variables, CORS, seed behaviour, and rollback.

## Table of contents

1. Local development
2. Frontend on Vercel
3. Backend on Fly.io
4. CORS configuration
5. Environment variable reference
6. Seed-on-first-boot
7. Rollback procedure

## 1. Local development

### docker-compose

`docker compose up --build` starts backend on port 8000 and frontend on port 3000. The backend uses a named volume `sqlite-data` mounted at `/data`; frontend mounts `src/` read-only for live reload. Copy `.env.example` to `.env` first; Docker Compose reads the file and also sets `DATABASE_URL=sqlite:////data/app.db` inline.

### Manual

```bash
cp .env.example .env
uv sync --project backend
uv run --project backend alembic upgrade head
uv run --project backend python -m app.seed.seed
uv run --project backend uvicorn app.main:app --reload --app-dir backend
pnpm --dir frontend install
pnpm --dir frontend dev
```

## 2. Frontend on Vercel

Build command: `pnpm --dir frontend build`. Output directory: `frontend/.next`. Node version 20.

Environment variables (set in Vercel dashboard):

| Name | Value example | Purpose |
|------|---------------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | `https://route53-api.fly.dev` | Backend origin |

`next.config.ts` rewrites `/api/*` to `${NEXT_PUBLIC_API_BASE_URL}/api/*`, so frontend calls stay same-origin in production; the cookie is set on the API domain and sent via the rewrite because Vercel proxies the request.

## 3. Backend on Fly.io

`fly.toml` (generated via `fly launch` or hand-written):

```toml
app = "route53-clone-api"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile"

[env]
  DATABASE_URL = "sqlite:////data/app.db"
  SESSION_COOKIE_NAME = "r53_session"
  SESSION_EXPIRE_HOURS = "24"
  CORS_ORIGINS = "https://route53-clone.vercel.app"
  SEED_ON_BOOT = "true"
  LOG_LEVEL = "info"

[http_service]
  internal_port = 8000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[mounts]]
  source = "r53_data"
  destination = "/data"

[deploy]
  release_command = "alembic upgrade head"

[[services.http_checks]]
  interval = "15s"
  timeout = "5s"
  grace_period = "10s"
  method = "GET"
  path = "/api/v1/health"
  protocol = "http"
```

Create the volume once: `fly volumes create r53_data --size 3 --region iad`. The Dockerfile runs `alembic upgrade head && uvicorn ...` as CMD; the release command runs migrations before the new machine takes traffic. SQLite WAL mode is enabled by the backend on connect; backup is via Fly volume snapshots.

## 4. CORS configuration

CORS origins come from the `CORS_ORIGINS` environment variable (comma-separated), not from hardcoded values. In development `http://localhost:3000` is allowed; in production only the Vercel origin. Credentials are allowed so cookies flow through. Preflight cache max-age 600.

## 5. Environment variable reference

| Name | Required | Default | Description |
|------|----------|---------|-------------|
| `DATABASE_URL` | yes | `sqlite:///./data/app.db` | SQLAlchemy URL |
| `CORS_ORIGINS` | yes | — | Comma-separated allowed origins |
| `SESSION_COOKIE_NAME` | yes | `r53_session` | Cookie name |
| `SESSION_EXPIRE_HOURS` | yes | `24` | Session lifetime |
| `SEED_ON_BOOT` | no | `false` | Seed empty DB on start |
| `LOG_LEVEL` | no | `info` | uvicorn/logging level |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | — | Public API origin for rewrites |

## 6. Seed-on-first-boot

When `SEED_ON_BOOT=true`, the backend startup sequence checks whether the `users` table has any rows. If empty, it creates the demo user `admin` / `password123`, one demo zone `example.com.`, and sample records. The check is idempotent by username and zone name; re-running never duplicates.

## 7. Rollback procedure

1. Backend: `fly deploy --image` with the previous Docker image tag, or `fly releases list` then `fly releases rollback`. Migrations are forward-only; if a deployed migration is bad, fix forward with a new Alembic revision rather than downgrading the production DB.
2. Frontend: Vercel dashboard → Deployments → Promote previous production deployment.
3. Database: restore from Fly volume snapshot before the bad deploy; run `alembic upgrade head` again.
