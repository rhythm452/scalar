"""Auth endpoints (docs/API.md §2)."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response

from app.core.config import settings
from app.core.deps import AuthServiceDep, CurrentUser, DbSession
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    LogoutResponse,
    SessionOut,
    SessionResponse,
)
from app.schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(
    body: LoginRequest, response: Response, db: DbSession, auth: AuthServiceDep
) -> LoginResponse:
    user, session, raw_token = await auth.login(db, body.username, body.password)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
        expires=session.expires_at,
    )
    return LoginResponse(
        user=UserOut.model_validate(user), session=SessionOut(expires_at=session.expires_at)
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    request: Request,
    response: Response,
    db: DbSession,
    auth: AuthServiceDep,
    _current_user: CurrentUser,
) -> LogoutResponse:
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        await auth.logout(db, token)
    response.delete_cookie(key=settings.session_cookie_name, path="/")
    return LogoutResponse()


@router.get("/session", response_model=SessionResponse)
async def get_session_info(current_user: CurrentUser) -> SessionResponse:
    return SessionResponse(user=UserOut.model_validate(current_user))
