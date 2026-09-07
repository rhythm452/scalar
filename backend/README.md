# Backend — Route 53 Clone (FastAPI)

See `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/API.md` for the build spec.

## Quick start

```bash
uv sync
uv run alembic upgrade head
uv run python -m app.seed.seed
uv run uvicorn app.main:app --reload --app-dir backend
```

Docs: `http://localhost:8000/docs`
