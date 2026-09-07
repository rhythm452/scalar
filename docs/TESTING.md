# TESTING

This document defines the test pyramid, fixtures, mocking strategy, E2E scenarios, visual-regression workflow, and CI wiring. Every phase exit gate references it.

## Table of contents

1. Test pyramid and targets
2. Backend tests
3. Frontend tests
4. E2E scenarios
5. Visual regression
6. CI wiring

## 1. Test pyramid and targets

| Layer | Tool | Target | Run command |
|-------|------|--------|-------------|
| Backend unit + integration | pytest + httpx AsyncClient + aiosqlite | >85% services/routers | `make test-backend` |
| Frontend unit + component | Vitest + React Testing Library + jsdom | >70% components | `make test-frontend` |
| End-to-end + visual regression | Playwright | 100% critical paths green | `make e2e` |
| Lint/types | Ruff, mypy, ESLint, tsc | zero warnings | `make lint` |

Coverage is a target, not a hard gate; behaviour is. Tests run in CI on every push and pull request.

## 2. Backend tests

Location: `backend/tests/`. Layout:

- `conftest.py` — session-scoped event loop, in-memory SQLite async engine (`sqlite+aiosqlite:///:memory:`), tables created via Alembic `upgrade`/`downgrade` around the test session, `AsyncSession` fixture per test, authenticated `client` fixture logging in as a seeded user.
- `factories.py` — `UserFactory`, `HostedZoneFactory`, `RecordSetFactory`, `ValueFactory`.
- `test_rules.py` — domain rules R1–R11, each in isolation.
- `test_services_zones.py` / `test_services_records.py` — service-layer CRUD and transactions.
- `test_api_*.py` — router-level integration tests using `httpx.AsyncClient` against FastAPI app.
- `test_seed.py` — idempotency and boot-empty detection.

In-memory SQLite: each test gets a fresh schema from the migration baseline, no shared state, no manual `Base.metadata.create_all`. Tests assert the counter stays in sync with record inserts/deletes, system records are protected, CNAME coexistence is rejected, and error bodies match the AWS envelope.

## 3. Frontend tests

Location: `frontend/src/**/*.test.{ts,tsx}` and `frontend/tests/`.

- Component tests: render Cloudscape islands with `@testing-library/react`, mock TanStack Query via `msw` or a wrapper with a fake query client.
- Hook tests: `useHostedZones`, `useCreateRecord`, etc. verified with `renderHook` + MSW.
- Form tests: submit invalid payloads and assert Zod error messages appear as `errorText`.
- API client tests: base64 cursor round-trip, error-envelope parser.

MSW handles API mocking at `http://localhost:8000/api/v1/*`. Tests assert loading, success, and error states; they mock `window.matchMedia` for Cloudscape responsive hooks and mock `next/navigation` where needed.

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

Playwright `toHaveScreenshot` captures full-page and component-level baselines for the zone list, zone detail, record wizard, dark mode, and mobile viewport (1280×720). Baselines live in `e2e/tests/__snapshots__/`. Update via `make e2e-update-snapshots` (runs `pnpm --dir e2e exec playwright test --update-snapshots`). Threshold `maxDiffPixelRatio=0.02` for fonts; anti-flakiness: wait for network idle, hide clock-driven timestamps, mock change status. CI diffs fail the build and upload `playwright-report` as artifact.

## 6. CI wiring

`.github/workflows/ci.yml` runs three jobs:

1. backend — uv sync, ruff, ruff format check, mypy, pytest with coverage.
2. frontend — pnpm install --frozen-lockfile, lint, tsc --noEmit, vitest.
3. e2e — install backend + frontend, install Playwright Chromium, build frontend, run backend in-memory, run Playwright tests.

No deployment is triggered automatically; release is manual via Vercel/Fly CLI per `docs/DEPLOYMENT.md`.
