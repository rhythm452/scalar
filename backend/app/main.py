"""FastAPI application scaffold. Implemented in Phase 2."""

from __future__ import annotations

from fastapi import FastAPI

app = FastAPI(title="Route 53 Clone API", version="0.1.0")


@app.get("/api/v1/health")
async def health() -> dict[str, str]:
    return {"ok": "true", "version": "0.1.0"}
