.PHONY: dev dev-backend dev-frontend test test-backend test-frontend lint lint-backend lint-frontend seed e2e build install

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

test: test-backend test-frontend

test-backend:
	uv run --project backend pytest backend/tests -q

test-frontend:
	pnpm --dir frontend test --run

lint: lint-backend lint-frontend

lint-backend:
	uv run --project backend ruff check backend && uv run --project backend ruff format --check backend && uv run --project backend mypy backend/app

lint-frontend:
	pnpm --dir frontend lint
	pnpm --dir frontend exec tsc --noEmit

seed:
	uv run --project backend python -m app.seed.seed --app-dir backend

e2e:
	pnpm --dir e2e exec playwright test

build:
	docker compose build
