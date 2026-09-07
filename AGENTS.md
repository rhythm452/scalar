# AGENTS

Standing rules for every future coding session on this repository.

## Branch and commit discipline

1. Each phase is built on a branch named `phase/N-<slug>` and merged via pull request.
   Phases 0 through 2 were built as local history before a remote existed and
   were merged into `main` as a single non-fast-forward merge commit once the
   repository was published; the PR-per-phase rule applies from Phase 3 onward.
2. Use Conventional Commits with scope, for example:
   - `feat(records): add CNAME coexistence guard`
   - `fix(api): return correct change status for INSYNC`
   - `docs(deployment): update Fly rollback steps`
   - `test(zones): assert duplicate name rejection`
3. Commit at meaningful checkpoints within a phase, not once at the end.
4. Do not commit `.env`, `.dev.vars`, `*.db`, or any token.

## Quality gates

1. CI must be green before a merge.
2. `make doctor` must pass locally before opening a phase branch's PR — it's the mechanical
   superset of CI's checks (migrations round-trip, layering, pragma concurrency, coverage floor
   with the greenlet config intact, seed idempotency, OpenAPI-vs-docs parity, secret scan,
   frontend build) and it also runs in CI, but catching a failure locally first is cheaper.
3. Any behaviour change updates the relevant doc in the same commit.
4. No `any` in TypeScript; no business logic in FastAPI routers.
5. Follow the layer contracts in `docs/ARCHITECTURE.md`: routers → services → repositories → models.

## Session start ritual

Before writing code for a phase, re-read the docs sections that phase implements. Reference them in commit messages and PR descriptions.
