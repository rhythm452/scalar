# CLAUDE.md

Operational context for this repo. Standing rules live in [AGENTS.md](AGENTS.md) — this file
doesn't duplicate them, just points at what a session needs before writing code.

## Stack (locked versions)

| Layer | Choice |
|-------|--------|
| Backend | FastAPI, Python 3.12, SQLAlchemy 2.0 async + Alembic, SQLite (WAL, FK on) |
| Frontend | Next.js 15.5.25, Cloudscape Design System, TanStack Query, pnpm 9 |
| Deploy | Cloudflare Workers (frontend, via OpenNext) + Fly.io (backend) behind a single-origin Worker proxy |
| Package managers | `uv` (backend), `pnpm` (frontend/e2e) — reproducible lockfiles, never install without one |

Full rationale for each choice is in `docs/DECISIONS.md` (ADRs 001–015, plus one open question,
ADR-016); don't re-litigate a decision that's already recorded there without adding a new ADR
that supersedes it.

## Layering — enforced mechanically, not by convention

`routers → services → repositories → models`. Services never import FastAPI or Starlette;
routers never contain business logic or reach into `app.repositories` directly. This isn't a
style preference: `backend/tests/unit/test_layering.py` statically parses every file's own
`import`/`from` AST nodes and fails the build on a violation — it already caught a real bug once
(routers calling repositories directly for a summary query, Phase 2). Adding an import that
violates the direction is a test failure, not a lint warning.

## Commands

```bash
make doctor          # required before merging any phase branch — see below
make dev             # docker compose up --build
make test            # backend + frontend
make lint            # ruff + mypy --strict + eslint + tsc
make seed            # run the idempotent seed against the configured DATABASE_URL
```

`make doctor` is the full mechanical gate (migrations round-trip, layering, coverage floor with
the greenlet-concurrency config intact, seed idempotency, OpenAPI-vs-docs parity, secret scan,
frontend build) — see `docs/TESTING.md` for what each check does and why. It must pass before a
phase branch merges; it also runs in CI.

## Commit and branch conventions

Conventional Commits with scope (`feat(records): ...`, `fix(ci): ...`). One commit per logical
change, not a single commit at the end of a session — each commit here should stand on its own
in `git log`. Phases 0–2 predate this repo having a remote and were merged as local history;
every phase from Phase 3 onward is a branch (`phase/N-<slug>`) merged via a real PR, per
AGENTS.md.

## Where the specs live

`docs/API.md` (REST contract), `docs/DATABASE.md` (schema + DDL), `docs/ROUTE53-DOMAIN-RULES.md`
(R1–R11 behavioural rules with exact error codes), `docs/ARCHITECTURE.md` (layer contracts,
request lifecycle), `docs/UI-PARITY.md` (Cloudscape mapping, copy, interactions). Read the
section a phase implements before writing code for it — this is AGENTS.md's own session-start
rule, repeated here because it's the single highest-leverage habit in this repo.

## Don't

- Don't add `# type: ignore` or `noqa` to silence a real problem — fix it or get a real
  exception from mypy/ruff config with a comment explaining why.
- Don't run `Base.metadata.create_all` in application code — schema changes are Alembic
  revisions, always (ADR-002).
- Don't touch the service/model/repository layers to satisfy a linter; only change them when a
  test exposes an actual bug.
