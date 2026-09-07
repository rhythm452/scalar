# Route 53 Console Clone

A pixel-faithful, full-stack clone of the AWS Route 53 console: hosted zones, record sets, change batches, tags, and BIND import/export, built with Next.js 15 + Cloudscape and FastAPI + SQLite.

> Not yet deployed — see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (planned for Phase 9).

## Table of contents

1. Feature checklist
2. Tech stack
3. Quick start
4. Repository structure
5. Documentation index
6. Screenshots
7. Testing
8. Deployment
9. Known limitations

## 1. Feature checklist

Mapped 1:1 to the assignment scope. Phase 2 (this session) completed the backend
API; the frontend (Phases 3–6) has not started, so every item touching UI is
at most "Partial" — backend implemented and tested, nothing to render it yet.

| # | Scope item | Status | Spec |
|---|------------|--------|------|
| 1 | Mock sign-in, session cookie, session persist across reload, logout | Partial (backend) | `docs/ARCHITECTURE.md` §6, `docs/API.md` §2 |
| 2 | Route 53 dashboard with summary counts | Partial (backend) | `docs/API.md` §8, `docs/UI-PARITY.md` §2 |
| 3 | Hosted zone list: search, type filter, sort, cursor pagination, column preferences | Partial (backend; column preferences is frontend-only) | `docs/API.md` §3, `docs/UI-PARITY.md` §2–4 |
| 4 | Create hosted zone (public/private, VPC, comment) with auto-created NS + SOA | Partial (backend) | `docs/ROUTE53-DOMAIN-RULES.md` R1 |
| 5 | Hosted zone detail with Records / Details / Tags tabs | Partial (backend data; tabs are frontend-only) | `docs/UI-PARITY.md` §2 |
| 6 | Edit hosted zone comment + tags (only editable fields, mirroring real console) | Partial (backend) | `docs/API.md` §3 |
| 7 | Delete hosted zone with HostedZoneNotEmpty guard + confirm modal | Partial (guard done; confirm modal is frontend-only) | `docs/ROUTE53-DOMAIN-RULES.md` R3 |
| 8 | Record table: search, type + routing-policy + alias filters, sort, pagination, bulk delete | Partial (backend; bulk delete UI pending) | `docs/API.md` §4 |
| 9 | Quick-create and wizard record creation for all 13 types | Partial (backend validates/creates all 13; forms pending) | `docs/ROUTE53-DOMAIN-RULES.md` R5–R8 |
| 10 | Edit record in SplitPanel drawer, delete record with system-record guard | Partial (guard done; drawer is frontend-only) | `docs/ROUTE53-DOMAIN-RULES.md` R2 |
| 11 | Bulk record batch endpoint (create/delete/upsert) | Done (backend) | `docs/API.md` §4 |
| 12 | Every mutation returns change ID PENDING → INSYNC; change lookup endpoint | Done (backend) | `docs/ROUTE53-DOMAIN-RULES.md` R11 |
| 13 | Tags CRUD on hosted zones | Partial (backend) | `docs/API.md` §3 |
| 14 | Mocked Health checks, Traffic policies, Resolver, Profiles, Domains inside AppLayout shell | Partial (backend stubs return well-formed empties; shell pending) | `docs/UI-PARITY.md` §2 |
| 15 | Bonus: BIND import (multipart) and export (json \| bind) | Planned (routes registered, return 501; Phase 7) | `docs/API.md` §6 |
| 16 | Dark mode, density, visual-refresh theming; keyboard shortcuts | Planned | `docs/UI-PARITY.md` §5 |
| 17 | Flashbar on every mutation, URL-synced filters, unsaved-changes guard | Planned | `docs/UI-PARITY.md` §4 |
| 18 | E2E + visual regression in `/e2e`, all wired into CI | Planned | `docs/TESTING.md` |

Backend status in full: 175 tests passing (`backend/tests/`), ruff and mypy
--strict clean, 92% coverage on services + core. See `docs/ROADMAP.md` for
the phase-by-phase plan.

## 2. Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Next.js 15 App Router + TypeScript strict | Server/client boundaries per route |
| UI | Cloudscape Design System + collection-hooks | The actual system the Route 53 console is built with; highest UI-parity weight |
| Server state | TanStack Query | Cache per query key with explicit invalidation on each mutation |
| Forms | React Hook Form + Zod | Uncontrolled inputs for large record forms; Zod mirrors backend per-type validation |
| Package manager | pnpm | Fast, strict, disk-efficient workspaces |
| Frontend deploy | Cloudflare Workers via @opennextjs/cloudflare | Single-origin with the backend; programmable edge proxy |
| Backend | FastAPI, Python 3.12 | Typed, async, Pydantic v2-native request/response modelling |
| ORM | SQLAlchemy 2.0 typed DeclarativeBase + Alembic | All schema change via versioned migrations, never create-all |
| Validation | Pydantic v2 schemas separate from ORM models | Routers never touch ORM objects directly |
| Deps | uv + pyproject.toml | Reproducible lockfile, fast CI installs |
| Lint/types | Ruff + mypy strict; ESLint + Prettier + strict TS, no `any` | Graded code-quality gates enforced in CI |
| Database | SQLite, WAL mode, FK ON | Single-file persistence on Fly volume; zero-ops for contest scope |
| Tests | pytest + httpx AsyncClient; Vitest + RTL; Playwright | Pyramid with >85% backend service/router target |
| Backend deploy | Fly.io + `/data` volume | Stateful single-machine backend behind the Worker proxy |

## 3. Quick start

Prerequisites: Docker + Compose, Node 20 + pnpm 9, Python 3.12 + uv.

### Path A — docker-compose (recommended)

```bash
cp .env.example .env
docker compose up --build
```

Frontend: `http://localhost:3000`. Backend: `http://localhost:8000/docs`. Seed user: `admin` / `password123` (see `docs/DEPLOYMENT.md` §6).

### Path B — manual

```bash
cp .env.example .env
uv sync --project backend
uv run --project backend alembic upgrade head
uv run --project backend python -m app.seed.seed
uv run --project backend uvicorn app.main:app --reload --app-dir backend --port 8000
pnpm --dir frontend install
pnpm --dir frontend dev
```

### Path C — production-accurate Worker proxy locally

```bash
cp frontend/.dev.vars.example frontend/.dev.vars
pnpm --dir frontend preview   # opennextjs-cloudflare build + wrangler dev
```

Seed is idempotent and runs on backend boot when the DB is empty (`docs/DATABASE.md` §9).

## 4. Repository structure

```text
route53-clone/
├── README.md  LICENSE  .gitignore  .editorconfig  .env.example
├── AGENTS.md  docker-compose.yml  Makefile
├── .github/workflows/ci.yml  .github/PULL_REQUEST_TEMPLATE.md
├── docs/  ARCHITECTURE DATABASE API UI-PARITY ROUTE53-DOMAIN-RULES
│          DECISIONS TESTING DEPLOYMENT ROADMAP screenshots/
├── backend/  pyproject.toml  alembic.ini  Dockerfile  fly.toml
│             app/ (main, core, api/v1, models, schemas, services,
│                   repositories, db, seed)  tests/
├── frontend/  package.json  tsconfig.json  next.config.ts  wrangler.jsonc
│              open-next.config.ts  Dockerfile
│              src/ (app, components, lib, hooks, types, proxy, middleware.ts)  tests/
└── e2e/  package.json  playwright.config.ts  tests/
```

## 5. Documentation index

| Doc | What it specifies |
|-----|-------------------|
| `AGENTS.md` | Standing rules for every coding session |
| `docs/ARCHITECTURE.md` | Layers, request lifecycles, frontend/backend/auth/state rules, single-origin path |
| `docs/DATABASE.md` | Full schema, DDL, indexes, migrations, seed |
| `docs/API.md` | REST contract, pagination, errors, curl per endpoint |
| `docs/UI-PARITY.md` | Cloudscape mapping, screen inventory, copy, interactions, theming, a11y |
| `docs/ROUTE53-DOMAIN-RULES.md` | Behavioural rules R1–R11 with exact error codes |
| `docs/DECISIONS.md` | ADRs 001–016 |
| `docs/TESTING.md` | Pyramid, fixtures, MSW, Playwright scenarios, visual regression, CI |
| `docs/DEPLOYMENT.md` | Local, Cloudflare Workers, Fly.io, CORS, env table, rollback |
| `docs/ROADMAP.md` | Phases 0–9 with deliverables and exit criteria |

## 6. Screenshots

| Slot | File |
|------|------|
| Hosted zone list | `docs/screenshots/hosted-zones-list.png` (screenshot placeholder — capture in Phase 9) |
| Zone detail + records | `docs/screenshots/zone-detail.png` (screenshot placeholder — capture in Phase 9) |
| Record wizard | `docs/screenshots/record-wizard.png` (screenshot placeholder — capture in Phase 9) |
| Dark mode | `docs/screenshots/dark-mode.png` (screenshot placeholder — capture in Phase 9) |

Reference captures of the real console used for copy verification live in the same folder.

## 7. Testing

```bash
make test-backend    # pytest + coverage
make test-frontend   # vitest run
make e2e             # playwright (needs frontend build + backend up)
make e2e-update      # regenerate Linux baselines
make lint            # ruff + mypy + eslint + tsc
```

Coverage target: >85% on backend services + routers. See `docs/TESTING.md`.

## 8. Deployment

See `docs/DEPLOYMENT.md` for the full Cloudflare Workers + Fly.io procedure, environment variables, and rollback steps.

## 9. Known limitations

1. Auth is a mocked single-credential check with an opaque session token, not AWS IAM or Cognito.
2. Demo credentials are shown on the login page by design (`docs/DECISIONS.md` ADR-015).
3. Health checks, traffic policies, Resolver, Profiles, and Domains are intentionally mocked UIs inside the real shell.
4. DNS does not actually resolve; change status flips PENDING → INSYNC on a stored timestamp, with no nameserver or background worker.
5. Single SQLite file on one Fly machine; no multi-region replication.
6. Private-zone VPC association is stored metadata only; no actual VPC validation.
