#!/usr/bin/env bash
# make doctor: the audit's mechanical checks, made repeatable. Each check
# runs independently -- one failing doesn't stop the rest, so a single run
# reports everything wrong instead of just the first thing. Exits non-zero
# if any check failed. See docs/TESTING.md for why each of these exists;
# most of them were added because a prior session's silent failure (a seed
# that wrote nothing while exiting 0, a coverage number 40 points wrong)
# would have been caught immediately by the check now sitting next to it.

set -uo pipefail
cd "$(dirname "$0")/.."

PASS=()
FAIL=()

section() {
  echo
  echo "=== $1 ==="
}

record() {
  if [ "$2" -eq 0 ]; then
    PASS+=("$1")
  else
    FAIL+=("$1")
  fi
}

# Scratch DBs live under the repo (not the system temp dir): on Windows a
# native sqlite3 driver can't resolve Git-Bash-style /tmp OR /e/... paths
# (both are MSYS translations); pwd -W gives the real Windows form there
# and doesn't exist on Linux, hence the fallback, which is what CI uses.
mkdir -p .doctor-scratch
REPO_ROOT="$(pwd -W 2>/dev/null || pwd)"

# 1. Alembic round trip: upgrade head, downgrade base, upgrade head; single head.
section "1. Alembic upgrade/downgrade/upgrade round trip"
DOCTOR_DB="$REPO_ROOT/.doctor-scratch/doctor-$$.db"
export DATABASE_URL="sqlite:///$DOCTOR_DB"
uv run --project backend alembic -c backend/alembic.ini upgrade head \
  && uv run --project backend alembic -c backend/alembic.ini downgrade base \
  && uv run --project backend alembic -c backend/alembic.ini upgrade head \
  && [ "$(uv run --project backend alembic -c backend/alembic.ini heads | wc -l)" -eq 1 ]
record "alembic round trip" $?
rm -f "$DOCTOR_DB"
unset DATABASE_URL

# 2. Migration-vs-metadata structural parity.
section "2. Migration/model structural parity"
uv run --project backend pytest backend/tests/unit/test_migration_parity.py -q
record "migration parity test" $?

# 3. Pragma verification under real pool concurrency.
section "3. SQLite pragmas under pooled concurrency"
uv run --project backend pytest backend/tests/integration/test_pragma_concurrency.py -q
record "pragma concurrency test" $?

# 4. Layering import-direction test.
section "4. Layering (import-direction) contract"
uv run --project backend pytest backend/tests/unit/test_layering.py -q
record "layering test" $?

# 5. ruff + mypy --strict, zero tolerance.
section "5. ruff + mypy --strict"
uv run --project backend ruff check backend \
  && uv run --project backend ruff format --check backend \
  && uv run --project backend mypy --config-file backend/pyproject.toml backend/app
record "ruff + mypy" $?

# 6. Full suite, coverage floor, and the greenlet-concurrency config itself
#    (losing that line silently restores the exact 40-point-wrong lie it
#    was added to fix -- see backend/pyproject.toml's own comment on it).
section "6. Full test suite + coverage floor (85% on services/core)"
grep -q 'concurrency = \["greenlet", "thread"\]' backend/pyproject.toml
CONCURRENCY_OK=$?
if [ $CONCURRENCY_OK -ne 0 ]; then
  echo "FAIL: backend/pyproject.toml is missing coverage.run concurrency = [\"greenlet\", \"thread\"]"
  echo "      Without it, coverage silently under-reports every line that runs across a"
  echo "      greenlet switch -- most of the service layer -- with no warning it's wrong."
fi
uv run --project backend pytest backend/tests -q \
  --cov=app.services --cov=app.core --cov-report=term-missing --cov-fail-under=85
COVERAGE_OK=$?
record "coverage config + floor" $((CONCURRENCY_OK || COVERAGE_OK))

# 7. Seed: scratch DB, non-zero row counts, idempotent on a second run.
section "7. Seed writes data and is idempotent"
SEED_DB="$REPO_ROOT/.doctor-scratch/doctor-seed-$$.db"
export DATABASE_URL="sqlite:///$SEED_DB"
uv run --project backend alembic -c backend/alembic.ini upgrade head >/dev/null
FIRST=$(uv run --project backend python -m app.seed.seed)
echo "$FIRST"
SECOND=$(uv run --project backend python -m app.seed.seed)
echo "$SECOND"
echo "$FIRST" | grep -q "^records: [1-9]"
FIRST_WROTE=$?
FIRST_COUNTS=$(echo "$FIRST" | grep '^records:\|^zones:')
SECOND_COUNTS=$(echo "$SECOND" | grep '^records:\|^zones:')
echo "$SECOND" | grep -q "no-op"
SECOND_NOOP=$?
[ "$FIRST_COUNTS" = "$SECOND_COUNTS" ]
COUNTS_MATCH=$?
record "seed writes + idempotent" $((FIRST_WROTE || SECOND_NOOP || COUNTS_MATCH))
rm -f "$SEED_DB"
unset DATABASE_URL

# 8. OpenAPI-vs-docs/API.md diff.
section "8. OpenAPI routes match docs/API.md"
uv run --project backend python backend/scripts/check_openapi_docs.py
record "openapi/docs parity" $?

# 9. Git history secret scan.
section "9. Git history secret scan (gitleaks)"
if command -v docker >/dev/null 2>&1; then
  MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd):/repo" zricethezav/gitleaks:latest \
    detect --source=/repo --log-opts="--all" -v
  record "secret scan" $?
else
  echo "SKIP: docker not available, cannot run gitleaks"
  record "secret scan (skipped, no docker)" 0
fi

# 10. Frontend: tsc, eslint, production build.
section "10. Frontend typecheck, lint, build"
pnpm --dir frontend exec tsc --noEmit \
  && pnpm --dir frontend lint \
  && pnpm --dir frontend build
record "frontend tsc/eslint/build" $?

echo
echo "=== make doctor report ==="
for name in "${PASS[@]:-}"; do
  [ -n "$name" ] && echo "  PASS  $name"
done
for name in "${FAIL[@]:-}"; do
  [ -n "$name" ] && echo "  FAIL  $name"
done

if [ "${#FAIL[@]}" -gt 0 ]; then
  echo
  echo "${#FAIL[@]} check(s) failed."
  exit 1
fi
echo
echo "All checks passed."
