"""v1 API surface: one router per resource, assembled here and mounted
under `/api/v1` in `app.main` (docs/API.md)."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.changes import router as changes_router
from app.api.v1.import_export import router as import_export_router
from app.api.v1.mocked import router as mocked_router
from app.api.v1.records import router as records_router
from app.api.v1.zones import router as zones_router

router = APIRouter()
router.include_router(auth_router)
router.include_router(zones_router)
router.include_router(records_router)
router.include_router(import_export_router)
router.include_router(changes_router)
router.include_router(mocked_router)

__all__ = ["router"]
