"""Auth request/response schemas (docs/API.md §2)."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.common import OkResponse
from app.schemas.user import UserOut


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str
    password: str


class SessionOut(BaseModel):
    expires_at: datetime


class LoginResponse(BaseModel):
    user: UserOut
    session: SessionOut


class SessionResponse(BaseModel):
    user: UserOut


class LogoutResponse(OkResponse):
    pass
