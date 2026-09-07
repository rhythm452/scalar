"""Import/export endpoints (docs/API.md §6): registered now so the OpenAPI
surface stays complete and honest, implemented in Phase 7. Both return 501
in the AWS error envelope rather than a bare FastAPI 501 or omitting the
routes from the documented contract entirely.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, UploadFile

from app.core.deps import CurrentUser
from app.core.errors import Route53Error
from app.schemas.error import ErrorEnvelope

router = APIRouter(prefix="/hostedzones/{zone_id}", tags=["import-export"])

_RESPONSES: dict[int | str, dict[str, Any]] = {
    501: {"model": ErrorEnvelope, "description": "Not implemented until Phase 7."}
}


def _not_implemented() -> Route53Error:
    return Route53Error("NotImplemented", "BIND import/export ships in Phase 7.", 501)


@router.post("/import", responses=_RESPONSES)
async def import_zone_file(zone_id: str, file: UploadFile, _current_user: CurrentUser) -> None:
    """Phase 7."""
    raise _not_implemented()


@router.get("/export", responses=_RESPONSES)
async def export_zone_file(zone_id: str, _current_user: CurrentUser) -> None:
    """Phase 7."""
    raise _not_implemented()
