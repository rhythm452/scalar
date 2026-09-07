"""User response shape shared by auth endpoints (docs/API.md §2)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    email: str
    display_name: str | None
    aws_account_id: str
