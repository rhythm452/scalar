"""Request-scoped dependencies (docs/ARCHITECTURE.md §6): DB session,
current-user resolution from the session cookie, and settings.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, settings
from app.core.errors import not_authorized
from app.db.session import get_session
from app.models import User
from app.services import (
    AuthService,
    ChangeService,
    HostedZoneService,
    RecordService,
    TagService,
    build_default_services,
)

# Services hold only injected repositories + a clock, no per-request state,
# so one set of singletons wired at import time is correct and avoids
# rebuilding them on every request.
_auth_service, _zone_service, _record_service, _change_service, _tag_service = (
    build_default_services()
)


def get_settings() -> Settings:
    return settings


async def get_db() -> AsyncIterator[AsyncSession]:
    async for session in get_session():
        yield session


def get_auth_service() -> AuthService:
    return _auth_service


def get_zone_service() -> HostedZoneService:
    return _zone_service


def get_record_service() -> RecordService:
    return _record_service


def get_change_service() -> ChangeService:
    return _change_service


def get_tag_service() -> TagService:
    return _tag_service


async def get_current_user(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    auth: Annotated[AuthService, Depends(get_auth_service)],
) -> User:
    """Cookie -> session -> user; 401 with the documented message on miss
    or expiry (docs/API.md §2)."""
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise not_authorized("No active session.")
    user, _session = await auth.resolve_session(db, token)
    return user


DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]
AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
ZoneServiceDep = Annotated[HostedZoneService, Depends(get_zone_service)]
RecordServiceDep = Annotated[RecordService, Depends(get_record_service)]
ChangeServiceDep = Annotated[ChangeService, Depends(get_change_service)]
TagServiceDep = Annotated[TagService, Depends(get_tag_service)]
