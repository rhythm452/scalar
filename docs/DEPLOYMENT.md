# DEPLOYMENT

## Fill these in before first deploy

- [ ] Import the repository into a Vercel project (vercel.com → Add New → Project); Vercel auto-detects Next.js, no config file required.
- [ ] Set `API_ORIGIN` in the Vercel project's Environment Variables to the deployed Fly.io backend URL (e.g. `https://scalar-api.fly.dev`).
- [ ] Add `FLY_API_TOKEN` as a GitHub repository secret (for the backend's CI deploy job only).
- [ ] Run `fly volumes create r53_data --size 3 --region bom --app scalar-api` once.

This document covers local development, Vercel frontend deployment, Fly.io backend deployment, environment variables, CORS, seed behaviour, and rollback. Cloudflare Workers was the original target (ADR-012); Vercel replaced it per ADR-020.

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

`docker compose up --build` starts the backend on port 8000 and the frontend on port 3000 using plain `next dev`. The backend uses a named volume `sqlite-data` mounted at `/data`; the frontend mounts `src/` read-only for live reload. Copy `.env.example` to `.env` first.

### Manual backend

```bash
cp .env.example .env
uv sync --project backend
uv run --project backend alembic -c backend/alembic.ini upgrade head
uv run --project backend python -m app.seed.seed
uv run --project backend uvicorn app.main:app --reload --app-dir backend --port 8000
```

### Manual frontend

```bash
pnpm --dir frontend install
pnpm --dir frontend dev
```

Seed is idempotent and runs on backend boot when the DB is empty (`docs/DATABASE.md` §13).

## 2. Frontend on Vercel

The Next.js 15 frontend deploys to Vercel using its native, zero-config Next.js support -- no adapter, no build plugin. `frontend/src/middleware.ts` runs as Vercel Edge Middleware and proxies `/api/*` to the Fly.io backend, so the browser sees a single origin. This eliminates third-party cookie restrictions that can silently drop sessions when the frontend and backend are on different origins (docs/DECISIONS.md ADR-013, ADR-020).

### First deploy

1. In the Vercel dashboard: Add New → Project → import this GitHub repository. Vercel detects Next.js automatically; set the project's root directory to `frontend`.
2. In the project's Settings → Environment Variables, add `API_ORIGIN` = the deployed Fly.io backend URL (e.g. `https://scalar-api.fly.dev`), for Production, Preview, and Development.
3. Deploy. Every subsequent push to `main` redeploys production automatically; every pull request gets its own preview deployment with its own URL, both handled entirely by Vercel's GitHub integration -- no CI workflow step is involved.

### Custom domain

Add a custom domain under the Vercel project's Settings → Domains. No `CORS_ORIGINS` change is needed on the backend regardless of domain, since `middleware.ts` always makes the browser-facing request same-origin.

### Environment variables vs secrets

Vercel's Environment Variables cover both cases here (`API_ORIGIN` is not sensitive). If a future secret is needed, mark it "Sensitive" in the same UI rather than introducing a separate mechanism.

## 3. Backend on Fly.io

`backend/fly.toml` is committed. It defines app `scalar-api`, region `bom`, a single always-on machine, and a volume mounted at `/data` for the SQLite file.

```bash
fly deploy --config backend/fly.toml --dockerfile backend/Dockerfile backend
```

The Dockerfile CMD runs `alembic upgrade head && uvicorn ...`. The Fly `release_command` also runs `alembic upgrade head` before traffic is accepted. SQLite WAL mode is enabled by the backend on connect; backup is via Fly volume snapshots.

## 4. CORS configuration

CORS origins come from the `CORS_ORIGINS` environment variable (comma-separated). In production this defaults to empty because `middleware.ts` proxies `/api/*` from the same origin, so no cross-origin preflight exists. CORS is enabled only for the local `next dev` path, where `CORS_ORIGINS=http://localhost:3000`. Credentials are allowed when CORS is active.

## 5. Environment variable reference

| Name | Required | Default | Description |
|------|----------|---------|-------------|
| `DATABASE_URL` | yes | `sqlite:///./data/app.db` | SQLAlchemy URL |
| `CORS_ORIGINS` | yes | — | Comma-separated allowed origins; empty in production |
| `SESSION_COOKIE_NAME` | yes | `r53_session` | Cookie name |
| `SESSION_EXPIRE_HOURS` | yes | `24` | Session lifetime |
| `SEED_ON_BOOT` | no | `false` | Seed empty DB on start |
| `LOG_LEVEL` | no | `info` | uvicorn/logging level |
| `COOKIE_SECURE` | no | `true` | Session cookie's `Secure` flag; set `false` for local plain-http dev, where a `Secure` cookie is silently dropped by the browser |
| `API_ORIGIN` | frontend | `http://localhost:8000` | FastAPI origin `middleware.ts` proxies to |

## 6. Seed-on-first-boot

When `SEED_ON_BOOT=true`, the backend startup sequence checks whether the `users` table has any rows. If empty, it creates the demo user `admin` / `password123`, one public zone `example.com.`, its auto-created NS/SOA system records, and sample A/MX/SRV records. The check is idempotent by username and zone name; re-running never duplicates.

## 7. Rollback procedure

1. Backend: `fly releases list` then `fly releases rollback`. Migrations are forward-only; if a deployed migration is bad, fix forward with a new Alembic revision rather than downgrading the production DB. Restore from a Fly volume snapshot if data corruption occurred.
2. Frontend: Vercel deployments can be rolled back instantly in the project's Deployments tab -- select any prior deployment and choose "Promote to Production," which repoints production traffic without a rebuild.
3. Database: restore from the most recent Fly volume snapshot before the bad deploy, then run `alembic upgrade head`.
