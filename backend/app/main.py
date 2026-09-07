"""FastAPI application scaffold. Implemented in Phase 2.

The lifespan wires the documented boot behaviour (docs/DATABASE.md §13):
when ``SEED_ON_BOOT=true`` and the ``users`` table is empty, the idempotent
seed populates the demo dataset. Migrations are NOT run here; they run as
the Docker CMD / Fly release command.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.db.session import session_factory
from app.seed.seed import run_seed


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if settings.seed_on_boot:
        async with session_factory() as db:
            await run_seed(db)
    yield


app = FastAPI(title="Route 53 Clone API", version="0.1.0", lifespan=lifespan)


@app.get("/api/v1/health")
async def health() -> dict[str, str]:
    return {"ok": "true", "version": "0.1.0"}
