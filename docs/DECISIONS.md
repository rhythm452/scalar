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
10. Open ADRs

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

## 10. Open ADRs

| ID | Question | Recommendation |
|----|----------|----------------|
| ADR-010 | BIND parser: hand-rolled vs `dnspython` | Recommend `dnspython` in backend dependencies for import correctness; decide in Phase 7 after license check |
| ADR-011 | Visual-regression baseline hosting (in-repo LFS vs Playwright artifacts) | Recommend in-repo `e2e/tests/__snapshots__` for reviewability; decide in Phase 8 |
