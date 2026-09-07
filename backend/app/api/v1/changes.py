"""Change lookup endpoint (docs/API.md §5)."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.deps import ChangeServiceDep, CurrentUser, DbSession
from app.schemas.change import ChangeDetail, ChangeDetailResponse

router = APIRouter(prefix="/changes", tags=["changes"])


@router.get("/{change_id}", response_model=ChangeDetailResponse)
async def get_change(
    change_id: str, db: DbSession, _current_user: CurrentUser, changes: ChangeServiceDep
) -> ChangeDetailResponse:
    batch = await changes.get(db, change_id)
    return ChangeDetailResponse(change=ChangeDetail.model_validate(batch))
