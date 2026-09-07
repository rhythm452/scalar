# DEPLOYMENT

## Fill these in before first deploy

- [ ] Replace `{FILL_ME}` in `frontend/wrangler.jsonc` with your Cloudflare account ID.
- [ ] Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub repository secrets (Settings → Secrets and variables → Actions).
- [ ] Add `FLY_API_TOKEN` as a GitHub repository secret.
- [ ] Run `fly volumes create r53_data --size 3 --region bom --app scalar-api` once.
- [ ] Run `wrangler whoami` locally to confirm you can publish to the account.

This document covers local development, Cloudflare Workers frontend deployment, Fly.io backend deployment, environment variables, CORS, seed behaviour, and rollback.

## Table of contents

1. Local development
2. Frontend on Cloudflare Workers
3. Backend on Fly.io
4. CORS configuration
5. Environment variable reference
6. Seed-on-first-boot
7. Rollback procedure

## 1. Local development

### docker-compose

`docker compose up --build` starts the backend on port 8000 and the frontend on port 3000 using plain `next dev`. The backend uses a named volume `sqlite-data` mounted at `/data`; the frontend mounts `src/` read-only for live reload. Copy `.env.example` to `.env` first.

### Cloudflare Worker path (production-accurate)

To test the real single-origin proxy locally:

```bash
cp frontend/.dev.vars.example frontend/.dev.vars
pnpm --dir frontend preview   # opennextjs-cloudflare build + wrangler dev
```

This serves the Worker on a local port and proxies `/api/*` to `http://localhost:8000` via `frontend/src/middleware.ts`.

### Manual backend

```bash
cp .env.example .env
uv sync --project backend
uv run --project backend alembic upgrade head
uv run --project backend python -m app.seed.seed
uv run --project backend uvicorn app.main:app --reload --app-dir backend --port 8000
```

### Manual frontend

```bash
pnpm --dir frontend install
pnpm --dir frontend dev
```

Seed is idempotent and runs on backend boot when the DB is empty (`docs/DATABASE.md` §9).

## 2. Frontend on Cloudflare Workers

The Next.js 15 frontend is built with `@opennextjs/cloudflare` and deployed to Cloudflare Workers via Wrangler. The Worker serves both the Next.js application and proxies `/api/*` requests to the Fly.io backend, so the browser sees a single origin. This eliminates third-party cookie restrictions that can silently drop sessions when the frontend and backend are on different origins.

### First deploy

```bash
cd frontend
pnpm install
pnpm run deploy
```

`wrangler.jsonc` configures the Worker name (`scalar-r53`), compatibility flags (`nodejs_compat`), the OpenNext worker entry (`.open-next/worker.js`), static assets, and the `API_ORIGIN` var pointing at `https://scalar-api.fly.dev`.

### Custom domain

After the first workers.dev deploy, add a custom domain in the Cloudflare dashboard or via `wrangler route`. Update `backend/fly.toml` `CORS_ORIGINS` only if you ever run the backend in a cross-origin mode; in production it is empty because the Worker is same-origin.

### Secrets vs vars

`API_ORIGIN` is a non-secret var in `wrangler.jsonc`. If you later need a secret (for example a preview-only API key), use `wrangler secret put KEY_NAME` instead of vars.

## 3. Backend on Fly.io

`backend/fly.toml` is committed. It defines app `scalar-api`, region `bom`, a single always-on machine, and a volume mounted at `/data` for the SQLite file.

```bash
fly deploy --config backend/fly.toml --dockerfile backend/Dockerfile backend
```

The Dockerfile CMD runs `alembic upgrade head && uvicorn ...`. The Fly `release_command` also runs `alembic upgrade head` before traffic is accepted. SQLite WAL mode is enabled by the backend on connect; backup is via Fly volume snapshots.

## 4. CORS configuration

CORS origins come from the `CORS_ORIGINS` environment variable (comma-separated). In production this defaults to empty because the Cloudflare Worker proxies `/api/*` from the same origin, so no cross-origin preflight exists. CORS is enabled only for the local `next dev` path, where `CORS_ORIGINS=http://localhost:3000`. Credentials are allowed when CORS is active.

## 5. Environment variable reference

| Name | Required | Default | Description |
|------|----------|---------|-------------|
| `DATABASE_URL` | yes | `sqlite:///./data/app.db` | SQLAlchemy URL |
| `CORS_ORIGINS` | yes | — | Comma-separated allowed origins; empty in production |
| `SESSION_COOKIE_NAME` | yes | `r53_session` | Cookie name |
| `SESSION_EXPIRE_HOURS` | yes | `24` | Session lifetime |
| `SEED_ON_BOOT` | no | `false` | Seed empty DB on start |
| `LOG_LEVEL` | no | `info` | uvicorn/logging level |
| `API_ORIGIN` | frontend/Worker | `http://localhost:8000` | FastAPI origin the Worker proxies to |

## 6. Seed-on-first-boot

When `SEED_ON_BOOT=true`, the backend startup sequence checks whether the `users` table has any rows. If empty, it creates the demo user `admin` / `password123`, one public zone `example.com.`, its auto-created NS/SOA system records, and sample A/MX/SRV records. The check is idempotent by username and zone name; re-running never duplicates.

## 7. Rollback procedure

1. Backend: `fly releases list` then `fly releases rollback`. Migrations are forward-only; if a deployed migration is bad, fix forward with a new Alembic revision rather than downgrading the production DB. Restore from a Fly volume snapshot if data corruption occurred.
2. Frontend: Cloudflare Workers deployments can be rolled back in the Cloudflare dashboard under Workers & Pages → scalar-r53 → Deployments → Rollback, or via `wrangler rollback`.
3. Database: restore from the most recent Fly volume snapshot before the bad deploy, then run `alembic upgrade head`.
