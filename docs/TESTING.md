# TESTING

This document defines the test pyramid, fixtures, mocking strategy, E2E scenarios, visual-regression workflow, and CI wiring. Every phase exit gate references it.

## Table of contents

1. Test pyramid and targets
2. Backend tests
3. Frontend tests
4. E2E scenarios
5. Visual regression
6. CI wiring
7. Testing against a Vercel preview deployment

## 1. Test pyramid and targets

| Layer | Tool | Target | Run command |
|-------|------|--------|-------------|
| Backend unit + integration | pytest + httpx AsyncClient + aiosqlite | >=85% on services/core | `make test-backend` |
| Frontend unit + component | Vitest + React Testing Library + jsdom | >70% components | `make test-frontend` |
| End-to-end + visual regression | Playwright | 100% critical paths green | `make e2e` |
| Lint/types | Ruff, mypy, ESLint, tsc | zero warnings | `make lint` |
| Full mechanical gate | `scripts/doctor.sh` (migrations, layering, pragma concurrency, coverage floor, seed idempotency, OpenAPI/docs parity, secret scan, frontend build) | all pass | `make doctor` |

Coverage is a target, not a hard gate; behaviour is. Tests run in CI on every push and pull request.
`make doctor` is the required gate before merging any phase branch (AGENTS.md) and runs in CI too.

## 2. Backend tests

Location: `backend/tests/`. Layout:

- `conftest.py` — per-test in-memory SQLite async engine (`sqlite+aiosqlite://` + `StaticPool`), schema from `alembic upgrade head` run over that connection (never `create_all`), typed service fixtures, an unauthenticated `client` and a logged-in `authed_client`/`seeded_client` (full demo dataset) against the real ASGI app.
- `unit/test_rules.py` — domain rules R1–R11, each in isolation.
- `unit/test_rdata.py` / `unit/test_dns_names.py` — per-type record-data and DNS-name validators.
- `unit/test_layering.py` — the AST-based import-direction contract.
- `unit/test_migration_parity.py` — Alembic schema vs. `Base.metadata.create_all` structural equality.
- `unit/test_seed.py` — idempotency and boot-empty detection.
- `unit/test_tags.py`, `unit/test_record_service_more.py` — additional service-layer coverage found while closing coverage gaps.
- `integration/test_auth.py`, `test_crud.py`, `test_filters.py`, `test_pagination.py`, `test_errors.py` — router-level integration tests over real HTTP (`httpx.AsyncClient`) against the FastAPI app, including the AWS error envelope.
- `integration/test_pragma_concurrency.py` — SQLite pragmas under real pooled connection concurrency, not just the single-connection in-memory engine every other test uses.

In-memory SQLite: each test gets a fresh schema from the migration baseline, no shared state, no manual `Base.metadata.create_all`. Tests assert the counter stays in sync with record inserts/deletes, system records are protected, CNAME coexistence is rejected, and error bodies match the AWS envelope.

## 3. Frontend tests

Location: `frontend/src/**/*.test.{ts,tsx}` and `frontend/tests/`. `frontend/tests/msw/handlers.ts` +
`server.ts` hold the MSW v2 mock server (`setupServer` from `msw/node`), wired into
`frontend/tests/setup.ts` (`server.listen/resetHandlers/close`, plus a `window.matchMedia` mock —
jsdom doesn't implement it and Cloudscape's responsive hooks call it directly).

Handlers are registered with **path-only patterns** (`http.post("/api/v1/auth/login", ...)`, no
origin) — Vitest's jsdom default origin is `http://localhost:3000`, but `apiFetch`
(`src/lib/api-client.ts`) calls same-origin-relative paths by design (ADR-013), so a handler
registered against a literal `http://localhost:8000/...` origin would never match.

Phase 3 test files (pattern for later phases to extend):

- `src/lib/api-client.test.ts` — success/error-envelope parsing, `buildQueryString`/cursor round-trip.
- `src/lib/safe-redirect.test.ts` — `sanitizeNextParam` against safe paths and open-redirect attempts.
- `src/proxy/auth-guard.test.ts` — the middleware page-guard's pure functions plus a real constructed `NextRequest`.
- `src/hooks/use-session.test.tsx`, `use-login.test.tsx` — `renderHook` + `QueryClientProvider` + MSW.
- `src/components/login/login-page-client.test.tsx` — Zod validation errors, 401 alert, sanitized-redirect navigation; mocks `next/navigation`.
- `src/components/shell/app-shell.test.tsx` — side navigation items, session-derived identity.
- `src/components/dashboard/dashboard-cards.test.tsx` — loading vs. loaded card copy.

Form tests submit invalid payloads and assert Zod error messages appear as `errorText`. Tests
assert loading, success, and error states.

## 4. E2E scenarios

Location: `e2e/tests/`. Scenarios mapped 1:1 to assignment requirements:

1. `auth.spec.ts` — login/logout, session persists across reload, redirect to `?next=`.
2. `zones-crud.spec.ts` — create public zone, create private zone with VPC, view detail, edit comment, delete empty zone, attempt delete non-empty zone and assert `HostedZoneNotEmpty` flashbar.
3. `zones-search.spec.ts` — create zones, filter by name, filter by type, sort by records/created, pagination with next_token.
4. `records-crud.spec.ts` — create records of types A, AAAA, CNAME, TXT, MX, NS, PTR, SRV, CAA (Phase 5 plus seeded NS/SOA), edit TTL, assert counter increments.
5. `records-search.spec.ts` — search by name/value, filter by type/policy/alias, sort, pagination.
6. `records-validation.spec.ts` — CNAME conflict, name outside zone, invalid A value, missing TTL, delete system SOA error.
7. `records-bulk.spec.ts` — select multiple rows via table checkbox, bulk delete via dropdown, confirm modal.
8. `changes.spec.ts` — after record mutation, assert flashbar contains change ID; poll change endpoint until INSYNC.
9. `mocked-screens.spec.ts` — visit /healthchecks, /trafficpolicies, /resolver, /profiles, /domains, assert AppLayout shell, breadcrumbs, Coming Soon container.
10. `theme.spec.ts` — toggle dark/light, assert token changes; run Playwright `dark-mode` project for visual baseline.
11. `keyboard.spec.ts` — Tab/Enter/Space through nav and table; modal Escape close; focus trap.
12. `tags.spec.ts` — add/edit/delete zone tags from detail Tags tab.

## 5. Visual regression

Playwright `toHaveScreenshot` captures full-page and component-level baselines for the zone list, zone detail, record wizard, dark mode, and mobile viewport (1280×720). Baselines live in `e2e/tests/__snapshots__/`. Update via `make e2e-update` (runs `pnpm --dir e2e exec playwright test --update-snapshots`). Threshold `maxDiffPixelRatio=0.02` for fonts; anti-flakiness: wait for network idle, hide clock-driven timestamps, mock change status. CI diffs fail the build and upload `playwright-report` as artifact.

### CI-versus-local platform note

Baselines are generated on the CI Linux Playwright image. They will not match a local macOS run because of font and sub-pixel rendering differences. Do not commit snapshots produced on macOS. To regenerate baselines locally using the same Linux image that CI uses:

```bash
docker run --rm -it \
  -v "$PWD:/work" \
  -w /work \
  mcr.microsoft.com/playwright:v1.47.0-jammy \
  sh -c "pnpm install && pnpm --dir e2e exec playwright test --update-snapshots"
```

Then commit the resulting `e2e/tests/__snapshots__/` files.

## 6. CI wiring

`.github/workflows/ci.yml` runs:

1. `check-secrets` — computes whether the Fly secret exists, as a job output; `deploy` keys off this instead of referencing `secrets` directly in a job-level `if:` (GitHub rejects that at parse time).
2. `backend` — uv sync, ruff, ruff format check, mypy, pytest with coverage.
3. `frontend` — pnpm install --frozen-lockfile, lint, tsc --noEmit, vitest.
4. `e2e` — install backend + frontend, install Playwright Chromium, build frontend, run backend in-memory, run Playwright tests (skips the Playwright run itself, not the setup, while `e2e/tests` has no specs yet).
5. `doctor` — runs `make doctor` (`scripts/doctor.sh`) in full.

On pushes to `main`, the `deploy` job deploys the backend to Fly.io, only when `FLY_API_TOKEN` is set. The frontend has no CI deploy step at all: Vercel's own GitHub integration builds a preview deployment for every PR and a production deployment on every push to `main` directly, independently of this workflow (docs/DECISIONS.md ADR-020). `backend`/`frontend`/`e2e`/`doctor` are unconditional and stay green independently of deployment credentials.

## 7. Testing against a Vercel preview deployment

For PR previews and staging, set the E2E base URL to the Vercel preview URL (visible on the PR, posted automatically by Vercel's GitHub integration):

```bash
E2E_BASE_URL=https://<preview>.vercel.app pnpm --dir e2e exec playwright test
```

The same suite runs against localhost in CI. Tests must not assume the backend is on the same host as the frontend; they only call `/api/*` paths and rely on `middleware.ts`'s proxy.
