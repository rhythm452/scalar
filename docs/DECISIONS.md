# DECISIONS

This log records every architecture decision reviewable under the judging criteria. Each later session implements these without revisiting them unless a new ADR supersedes one here.

## Table of contents

1. ADR-001 Cloudscape over hand-rolled UI
2. ADR-002 SQLite + Alembic over create-all
3. ADR-003 Cursor pagination over offset
4. ADR-004 Child table for record values
5. ADR-005 Denormalized record-set count
6. ADR-006 Session cookie auth over JWT
7. ADR-007 Surrogate record IDs despite Route 53 natural key
8. ADR-008 Fly.io volume for SQLite persistence
9. ADR-009 Change-batch modelling for API realism
10. ADR-010 dnspython as an optional dependency group for BIND parsing
11. ADR-011 Commit visual-regression baselines to the repository
12. ADR-012 Cloudflare Workers plus OpenNext over Vercel for the frontend
13. ADR-013 Single-origin Worker proxy over cross-origin CORS
14. ADR-014 Rejected Cloudflare D1 despite it being SQLite
15. ADR-015 Demo credentials shown on the login page
16. Open ADRs
17. ADR-017 ESLint 9 flat config, migrated now rather than deferred
18. ADR-018 CI secret-presence gating via a job output, not a job-level `if:`

## 1. ADR-001 Cloudscape over hand-rolled UI

Context: UI similarity to the real Route 53 console carries the highest judging weight, and the real console is built with AWS's Cloudscape design system.

Decision: Build every screen exclusively with `@cloudscape-design/components`, `global-styles`, `design-tokens`, and `collection-hooks`. No Tailwind, no custom table or modal primitives.

Alternatives considered: Tailwind + headless UI (rejected: cannot match AWS spacing, typography, and Table behaviours without months of CSS work); Ant Design / MUI (rejected: wrong visual language, instant parity loss).

Consequences: Cloudscape components are client-side, forcing the `"use client"` island strategy in `docs/ARCHITECTURE.md` §5; bundle size grows; but reviewer eye-test parity is maximized and dark mode, density, and CollectionPreferences come for free.

## 2. ADR-002 SQLite + Alembic over create-all

Context: The contest requires graded database design with reviewable schema evolution.

Decision: SQLite with WAL journal mode and foreign keys ON, with every schema change delivered as an Alembic migration. `Base.metadata.create_all` is forbidden in application code.

Alternatives considered: `create_all` on boot (rejected: unreviewable, no downgrade path, fails the migration-strategy criterion); Postgres (rejected: operational overhead disproportionate to single-file contest scope and Fly single-machine deploy).

Consequences: Migrations must be written and reviewed in Phase 1; seed runs only when tables are empty; CI runs `alembic upgrade head` before tests.

## 3. ADR-003 Cursor pagination over offset

Context: Zone and record lists must match Route 53's continuation-token behaviour and stay stable under concurrent inserts.

Decision: Opaque cursor tokens: base64url of the last row's sort key `(sort_value, id)`. No `offset`/`limit` params anywhere; page size only plus `next_token`.

Alternatives considered: Offset/limit (rejected: skips/duplicates rows when data changes between pages; diverges from Route 53's NextRecordName/NextRecordType model); keyset exposed raw (rejected: leaks internals, harder to evolve sort keys).

Consequences: Every list endpoint and every Table must thread the token through; tests assert token opacity and stability; documented mapping to Route 53 continuation semantics in `docs/API.md` §9.

## 4. ADR-004 Child table for record values

Context: Route 53 allows multiple values per record set (e.g. several A addresses).

Decision: Model values as a child table `resource_record_values(record_set_id, value, sort_order)` rather than a newline-delimited TEXT blob on the parent.

Alternatives considered: TEXT blob with newline joins (rejected: breaks atomic per-value validation, ordering, and indexed search; forces application-level parsing for every read); JSON array column (rejected: SQLite JSON support is adequate but per-value constraints and ordering are weaker than a real foreign-key table).

Consequences: One extra join on record reads; bulk validation iterates rows; ordering is explicit via `sort_order`; the graded schema-reasoning criterion is satisfied directly.

## 5. ADR-005 Denormalized record-set count

Context: Zone lists and the detail header show "Records (N)" without paying a COUNT per row.

Decision: Maintain `hosted_zones.record_set_count` as a denormalized integer, incremented/decremented by the record service inside the same transaction as the record write.

Alternatives considered: Live `COUNT(*)` per zone (rejected: N+1 query cost on every list page); materialized view / trigger (rejected: SQLite trigger logic is invisible to the service layer and harder to test).

Consequences: The counter can drift if writes bypass the service, so repositories expose no direct record insert; a Phase 1 reconciliation test asserts counter parity; documented in `docs/DATABASE.md`.

## 6. ADR-006 Session cookie auth over JWT for a mocked system

Context: Auth is explicitly mocked; there is no identity provider and no cross-service trust boundary needing stateless tokens.

Decision: Opaque random session token, SHA-256 hashed at rest in `sessions`, delivered as an httpOnly `SameSite=Lax` cookie, validated statefully per request.

Alternatives considered: JWT in localStorage (rejected: XSS-exfiltrable, revocation requires blocklists, overkill for a mock); HTTP Basic per request (rejected: exposes password hash verification on every call, no expiry story).

Consequences: Requires server-side session storage and cookie handling in E2E; logout is a real row delete; frontend needs no token-refresh logic.

## 7. ADR-007 Surrogate record IDs despite Route 53 natural key

Context: Real Route 53 identifies record sets by the natural key (name, type, set-identifier) with no stable ID.

Decision: Keep an internal UUID surrogate `resource_record_sets.id` for routing (`PUT/DELETE .../rrsets/{rid}`) and Table selection, while additionally enforcing the natural-key UNIQUE constraint.

Alternatives considered: Pure natural-key routing (rejected: URL-encoding names/types/identifiers is brittle, renames become identity changes, Table selection keys unstable).

Consequences: Documented discrepancy in `docs/DATABASE.md`; API still validates natural-key uniqueness with Route 53 error codes; import/export maps natural keys to surrogate rows internally.

## 8. ADR-008 Fly.io volume for SQLite persistence

Context: Backend deploys to Fly.io as a single machine and SQLite is a local file.

Decision: Mount a Fly volume at `/data`, point `DATABASE_URL` at `sqlite:////data/app.db`, run `alembic upgrade head` as the release command, and enable WAL mode.

Alternatives considered: Ephemeral disk (rejected: data loss on every deploy/restart); managed Postgres (rejected: cost and ops overhead for contest scale).

Consequences: Single-machine write scaling only; backups are volume snapshots; local dev mirrors the path via `./data`.

## 9. ADR-009 Change-batch modelling for API realism

Context: The real Route 53 API returns a change ID with PENDING status for every record mutation, and the console surfaces it.

Decision: Model `change_batches` + `change_batch_items` as first-class tables; every record mutation inserts a batch row and returns `{change: {id, status: "PENDING"}}`; status derives from `submitted_at` age without a worker.

Alternatives considered: No change model, return the record only (rejected: loses high-signal realism the judges explicitly reward); background worker flipping status (rejected: extra process for a cosmetic transition).

Consequences: Extra insert per mutation inside the same transaction; `GET /changes/{id}` endpoint; UI flashbars quote the change ID.

## 10. ADR-010 dnspython as an optional dependency group for BIND parsing

Context: Phase 7 adds BIND zone-file import and export. Parsing zone files by hand is error-prone for record types like NAPTR, DS, and multi-string TXT.

Decision: Add `dnspython>=2.6` under `[project.optional-dependencies] bind` in `backend/pyproject.toml`. Install in production and CI with `uv sync --extra bind` (or equivalent). The application imports `dns.zone` and `dns.rdatatype` only inside the import/export service.

Alternatives considered: Hand-rolled parser (rejected: high bug surface for graded correctness); `dnspython` as a core dependency (rejected: the rest of the backend does not need it until Phase 7).

Consequences: Slightly larger production image after Phase 7; BIND round-trip fidelity improves; license is ISC-compatible.

## 11. ADR-011 Commit visual-regression baselines to the repository

Context: Playwright `toHaveScreenshot` needs baseline images. The most common failure mode is generating baselines on macOS and comparing them against the Linux CI runner, where font rendering differs.

Decision: Commit baselines to `e2e/tests/__snapshots__/`. Generate and update them using the same Linux Playwright Docker image that CI uses. Provide a `make e2e-update` target and a documented docker command for local regeneration.

Alternatives considered: Git LFS (rejected: extra setup for judges); CI artifacts only (rejected: harder to review diffs in PRs); per-developer baselines (rejected: platform inconsistency).

Consequences: PRs include snapshot diffs; contributors must use the Linux container to update baselines; the platform-caveat is documented plainly.

## 12. ADR-012 Cloudflare Workers plus OpenNext over Vercel for the frontend

Context: Phase 0 originally targeted Vercel for the frontend. The build must still be serverless/edge and easy to link to a public URL.

Decision: Build the Next.js 15 frontend with `@opennextjs/cloudflare` and deploy to Cloudflare Workers via Wrangler. The public URL is `https://scalar-r53.workers.dev`.

Alternatives considered: Vercel (rejected: while simpler, it forces a cross-origin boundary if the backend stays on Fly.io, which conflicts with ADR-013; Cloudflare gives us a programmable proxy at the edge).

Consequences: Build pipeline runs `opennextjs-cloudflare`; local development can use either `next dev` or `wrangler dev`; Wrangler and account credentials are required.

## 13. ADR-013 Single-origin Worker proxy over cross-origin CORS

Context: The FastAPI backend lives on Fly.io and the frontend on Cloudflare Workers. API calls could be cross-origin with CORS, or same-origin via a Worker proxy.

Decision: The Cloudflare Worker intercepts `/api/*` and proxies those requests to the Fly.io FastAPI origin. The browser sees one origin, so the session cookie is first-party (`HttpOnly`, `Secure`, `SameSite=Lax`) and no CORS preflight occurs.

Alternatives considered: Cross-origin with `SameSite=None` cookies and CORS (rejected: Safari ITP and Chrome third-party cookie restrictions can silently drop `SameSite=None` cookies, causing a judge to appear logged out after refresh; this failure is invisible during local same-origin development). A separate API subdomain with CORS and token auth (rejected: conflicts with the mocked session-cookie architecture).

Consequences: Each API request incurs one extra hop (Cloudflare edge → Fly.io origin), adding roughly 30–60 ms; caching is disabled for API paths; the Worker must correctly forward cookies, multipart bodies, status codes, and the AWS error envelope.

## 14. ADR-014 Rejected Cloudflare D1 despite it being SQLite

Context: Cloudflare offers D1, a SQLite-based database. Using it would colocate storage with the Worker.

Decision: Rejected. The assignment mandates SQLite behind FastAPI. D1 is reachable only over HTTP from Python, which would forfeit SQLAlchemy 2.0, Alembic migrations, and the typed declarative model layer that the judging criteria explicitly grade. Persistence is already satisfied by the Fly.io volume.

Consequences: The backend stays on Fly.io; the Worker remains stateless; we keep the full SQLAlchemy/Alembic toolchain.

## 15. ADR-015 Demo credentials shown on the login page

Context: Auth is mocked; judges evaluate many submissions and login friction hurts more than mock security theatre helps.

Decision: The `/login` page renders a Cloudscape `Alert` with `type="info"`, header `"Demo credentials"`, showing username `admin` and password `password123` verbatim. This is an intentional, documented deviation from a real AWS sign-in page.

Alternatives considered: Hidden credentials in README only (rejected: judges may not read it before logging in); real auth (rejected: out of scope).

Consequences: The login page is immediately usable; E2E tests can rely on visible credentials; the deviation is noted in `docs/UI-PARITY.md`.

## 16. Open ADRs

| ID | Question | Recommendation |
|----|----------|----------------|
| ADR-016 | Custom domain vs workers.dev for the public app | Keep workers.dev for the contest to avoid DNS provisioning; move to a custom domain only if required |

## 17. ADR-017 ESLint 9 flat config, migrated now rather than deferred

Context: `eslint@8.57.0` is end-of-life; `eslint-config-next@15.5.25`'s `peerDependencies` already
support `^9`. Migrating means moving from `.eslintrc.json` to flat-config `eslint.config.mjs`.

Decision: Migrate to ESLint 9 during the Phase 2.5 repair pass, before any frontend application
code exists, using `@eslint/eslintrc`'s `FlatCompat` to bridge `eslint-config-next`'s still-legacy-
shaped config (`compat.extends("next/core-web-vitals")`) into flat config.

Alternatives considered: defer to Phase 3 or later (rejected: at that point real application code
and possibly custom lint rules/overrides exist, turning a mechanical migration into one that can
break a lint config a judge is actively looking at, for the same eventual work); stay on ESLint 8
for the whole contest (rejected: ships a visibly end-of-life tool, a code-quality signal explicitly
graded).

Consequences: `eslint-config-next`'s peer range caps at `^9`, not the now-current `10.x` line, so
`9.x` (itself past npm's own "no longer supported" window as of this session) is what's actually
achievable today; moving to 10 is blocked on `eslint-config-next` (or Next's own tooling)
catching up, not something to force. `@testing-library/jest-dom` was pinned to `6.9.1` in the same
pass for an unrelated but adjacent reason: `6.10.0` is a flagged bad release requiring Node >=22 in
what should have been a non-breaking minor.

## 18. ADR-018 CI secret-presence gating via a job output, not a job-level `if:`

Context: `preview`/`deploy` jobs need `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/
`FLY_API_TOKEN`, which don't exist as repository secrets yet. Without a guard, those jobs fail
outright instead of skipping, and a lint-and-test pipeline shouldn't depend on deployment
credentials to stay green.

Decision: A `check-secrets` job computes presence inside a step (`env:`/`run:` can read `secrets`
fine) and exposes it as a job `output`; `preview`/`deploy` key their `if:` off
`needs.check-secrets.outputs.has_cloudflare`/`has_fly` instead.

Alternatives considered: `if: ${{ secrets.CLOUDFLARE_API_TOKEN != '' }}` directly on the job
(rejected: reproduced twice — GitHub rejects the entire workflow file at parse time when a
job-level `if:` references the `secrets` context at all, wrapped in `${{ }}` or not; this isn't
documented anywhere obvious and cost real iteration to isolate). Requiring the secrets to exist
before merging (rejected: blocks publishing the repository and getting CI green at all, which was
the more urgent problem this session).

Consequences: One extra always-green job (`check-secrets`) in every run; `preview`/`deploy` stay
skippable without failing; the pattern generalises to any future job gated on optional secrets.
