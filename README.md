# Route 53 Console Clone

A pixel-faithful, full-stack clone of the AWS Route 53 console: hosted zones, record sets, change batches, tags, and BIND import/export, built with Next.js 15 + Cloudscape and FastAPI + SQLite.

> Live demo: `https://YOUR-VERCEL-URL-HERE` (demo link placeholder — replaced on deploy in Phase 9).

## Table of contents

1. Feature checklist
2. Tech stack
3. Quick start
4. Repository structure
5. Documentation index
6. Screenshots
7. Testing
8. Known limitations

## 1. Feature checklist

Mapped 1:1 to the assignment scope.

| # | Scope item | Status | Spec |
|---|------------|--------|------|
| 1 | Mock sign-in, session cookie, session persist across reload, logout | Planned | `docs/ARCHITECTURE.md` §6, `docs/API.md` §2 |
| 2 | Route 53 dashboard with summary counts | Planned | `docs/API.md` §8, `docs/UI-PARITY.md` §2 |
| 3 | Hosted zone list: search, type filter, sort, cursor pagination, column preferences | Planned | `docs/API.md` §3, `docs/UI-PARITY.md` §2–4 |
| 4 | Create hosted zone (public/private, VPC, comment) with auto-created NS + SOA | Planned | `docs/ROUTE53-DOMAIN-RULES.md` R1 |
| 5 | Hosted zone detail with Records / Details / Tags tabs | Planned | `docs/UI-PARITY.md` §2 |
| 6 | Edit hosted zone comment + tags (only editable fields, mirroring real console) | Planned | `docs/API.md` §3 |
| 7 | Delete hosted zone with HostedZoneNotEmpty guard + confirm modal | Planned | `docs/ROUTE53-DOMAIN-RULES.md` R3 |
| 8 | Record table: search, type + routing-policy + alias filters, sort, pagination, bulk delete | Planned | `docs/API.md` §4 |
| 9 | Quick-create and wizard record creation for all 13 types | Planned | `docs/ROUTE53-DOMAIN-RULES.md` R5–R8 |
| 10 | Edit record in SplitPanel drawer, delete record with system-record guard | Planned | `docs/ROUTE53-DOMAIN-RULES.md` R2 |
| 11 | Bulk record batch endpoint (create/delete/upsert) | Planned | `docs/API.md` §4 |
| 12 | Every mutation returns change ID PENDING → INSYNC; change lookup endpoint | Planned | `docs/ROUTE53-DOMAIN-RULES.md` R11 |
| 13 | Tags CRUD on hosted zones | Planned | `docs/API.md` §3 |
| 14 | Mocked Health checks, Traffic policies, Resolver, Profiles, Domains inside AppLayout shell | Planned | `docs/UI-PARITY.md` §2 |
| 15 | Bonus: BIND import (multipart) and export (json \| bind) | Planned | `docs/API.md` §6 |
| 16 | Dark mode, density, visual-refresh theming; keyboard shortcuts | Planned | `docs/UI-PARITY.md` §5 |
| 17 | Flashbar on every mutation, URL-synced filters, unsaved-changes guard | Planned | `docs/UI-PARITY.md` §4 |
| 18 | E2E + visual regression in `/e2e`, all wired into CI | Planned | `docs/TESTING.md` |

## 2. Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Frontend | Next.js 15 App Router + TypeScript strict | Server/client boundaries per route; Vercel-native deploy |
| UI | Cloudscape Design System + collection-hooks | The actual system the Route 53 console is built with; highest UI-parity weight |
| Server state | TanStack Query | Cache per query key with explicit invalidation on each mutation |
| Forms | React Hook Form + Zod | Uncontrolled inputs for large record forms; Zod mirrors backend per-type validation |
| Package manager | pnpm | Fast, strict, disk-efficient workspaces |
| Backend | FastAPI, Python 3.12 | Typed, async, Pydantic v2-native request/response modelling |
| ORM | SQLAlchemy 2.0 typed DeclarativeBase + Alembic | All schema change via versioned migrations, never create-all |
| Validation | Pydantic v2 schemas separate from ORM models | Routers never touch ORM objects directly |
| Deps | uv + pyproject.toml | Reproducible lockfile, fast CI installs |
| Lint/types | Ruff + mypy strict; ESLint + Prettier + strict TS, no `any` | Graded code-quality gates enforced in CI |
| Database | SQLite, WAL mode, FK ON | Single-file persistence on Fly volume; zero-ops for contest scope |
| Tests | pytest + httpx AsyncClient; Vitest + RTL; Playwright | Pyramid with >85% backend service/router target |
| Deploy | Vercel (frontend), Fly.io + `/data` volume (backend) | Static edge frontend; stateful single-machine backend |

## 3. Quick start

Prerequisites: Docker + Compose, Node 20 + pnpm 9, Python 3.12 + uv.

### Path A — docker-compose (recommended)

```bash
cp .env.example .env
docker compose up --build
```

Frontend: `http://localhost:3000`. Backend: `http://localhost:8000/docs`. Seed user: `admin` / `password123` (see `docs/DEPLOYMENT.md` §7).

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

Seed is idempotent and runs on backend boot when the DB is empty (`docs/DATABASE.md` §9).

## 4. Repository structure

```text
route53-clone/
├── README.md  LICENSE  .gitignore  .editorconfig  .env.example
├── docker-compose.yml  Makefile
├── .github/workflows/ci.yml  .github/PULL_REQUEST_TEMPLATE.md
├── docs/  ARCHITECTURE DATABASE API UI-PARITY ROUTE53-DOMAIN-RULES
│          DECISIONS TESTING DEPLOYMENT ROADMAP screenshots/
├── backend/  pyproject.toml  alembic.ini  Dockerfile
│             app/ (main, core, api/v1, models, schemas, services,
│                   repositories, db, seed)  tests/
├── frontend/  package.json  tsconfig.json  next.config.ts
│              src/ (app, components, lib, hooks, types)  tests/
└── e2e/  package.json  playwright.config.ts  tests/
```

## 5. Documentation index

| Doc | What it specifies |
|-----|-------------------|
| `docs/ARCHITECTURE.md` | Layers, request lifecycles, frontend/backend/auth/state rules |
| `docs/DATABASE.md` | Full schema, DDL, indexes, migrations, seed |
| `docs/API.md` | REST contract, pagination, errors, curl per endpoint |
| `docs/UI-PARITY.md` | Cloudscape mapping, screen inventory, copy, interactions, theming, a11y |
| `docs/ROUTE53-DOMAIN-RULES.md` | Behavioural rules R1–R11 with exact error codes |
| `docs/DECISIONS.md` | ADRs 001–009 + open questions |
| `docs/TESTING.md` | Pyramid, fixtures, MSW, Playwright scenarios, visual regression, CI |
| `docs/DEPLOYMENT.md` | Local, Vercel, Fly.io, CORS, env table, rollback |
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
make lint            # ruff + mypy + eslint + tsc
```

Coverage target: >85% on backend services + routers. See `docs/TESTING.md`.

## 8. Known limitations

1. Auth is a mocked single-credential check with an opaque session token, not AWS IAM or Cognito.
2. Health checks, traffic policies, Resolver, Profiles, and Domains are intentionally mocked UIs inside the real shell.
3. DNS does not actually resolve; change status flips PENDING → INSYNC on a stored timestamp, with no nameserver or background worker.
4. Single SQLite file on one Fly machine; no multi-region replication.
5. Private-zone VPC association is stored metadata only; no actual VPC validation.
