"""Change batch response schemas (docs/API.md §5, R11)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChangeSummary(BaseModel):
    """The ``change`` object every record mutation returns (R11)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    status: str
    submitted_at: datetime


class ChangeDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    hosted_zone_id: str
    status: str
    submitted_at: datetime
    comment: str | None


class ChangeDetailResponse(BaseModel):
    change: ChangeDetail
