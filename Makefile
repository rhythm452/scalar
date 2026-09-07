.PHONY: dev dev-backend dev-frontend cf-dev cf-deploy fly-deploy test test-backend test-frontend lint lint-backend lint-frontend seed e2e e2e-update build install

install:
	pnpm --dir frontend install
	pnpm --dir e2e install
	uv sync --project backend

dev:
	docker compose up --build

dev-backend:
	uv run --project backend uvicorn app.main:app --reload --port 8000 --app-dir backend

dev-frontend:
	pnpm --dir frontend dev

cf-dev:
	pnpm --dir frontend preview

cf-deploy:
	pnpm --dir frontend deploy

fly-deploy:
	fly deploy --config backend/fly.toml --dockerfile backend/Dockerfile backend

test: test-backend test-frontend

test-backend:
	uv run --project backend pytest backend/tests -q

test-frontend:
	pnpm --dir frontend test

lint: lint-backend lint-frontend

lint-backend:
	uv run --project backend ruff check backend && uv run --project backend ruff format --check backend && uv run --project backend mypy --config-file backend/pyproject.toml backend/app

lint-frontend:
	pnpm --dir frontend lint
	pnpm --dir frontend exec tsc --noEmit

seed:
	uv run --project backend python -m app.seed.seed --app-dir backend

e2e:
	@if find e2e/tests -name '*.spec.ts' | grep -q .; then \
		pnpm --dir e2e exec playwright test; \
	else \
		echo "No Playwright specs yet (e2e/tests is still scaffolding, Phase 8) -- skipping."; \
	fi

e2e-update:
	pnpm --dir e2e exec playwright test --update-snapshots

build:
	docker compose build
