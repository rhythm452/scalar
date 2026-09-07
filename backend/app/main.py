"""FastAPI application assembly (docs/ARCHITECTURE.md §6).

The lifespan wires the documented boot behaviour (docs/DATABASE.md §13):
when ``SEED_ON_BOOT=true`` and the ``users`` table is empty, the idempotent
seed populates the demo dataset. Migrations are NOT run here; they run as
the Docker CMD / Fly release command.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1 import router as api_v1_router
from app.core.config import settings
from app.core.exception_handlers import install_exception_handlers
from app.core.request_id import RequestIdMiddleware
from app.db.session import session_factory
from app.seed.seed import run_seed


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if settings.seed_on_boot:
        async with session_factory() as db:
            await run_seed(db)
    yield


app = FastAPI(title="Route 53 Clone API", version="0.1.0", lifespan=lifespan)

app.add_middleware(RequestIdMiddleware)
install_exception_handlers(app)
app.include_router(api_v1_router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health() -> dict[str, str]:
    return {"ok": "true", "version": "0.1.0"}
