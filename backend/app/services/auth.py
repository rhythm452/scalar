"""Authentication service (docs/ARCHITECTURE.md §7, docs/API.md §2).

Mocked credential check against the seeded user with passlib argon2;
opaque session tokens with only the SHA-256 hash stored. ``last_seen_at``
refreshes on every authenticated request. The raw token never leaves the
auth boundary: routers set the cookie, services return it exactly once
at login.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import Route53Error, not_authorized
from app.core.security import hash_token, new_session_token, verify_password
from app.models import User, UserSession
from app.repositories import SessionRepository, UserRepository


def default_clock() -> datetime:
    return datetime.now(UTC)


DEFAULT_CLOCK: Callable[[], datetime] = default_clock


class AuthService:
    def __init__(
        self,
        *,
        users: UserRepository,
        sessions: SessionRepository,
        clock: Callable[[], datetime] = DEFAULT_CLOCK,
    ) -> None:
        self._users = users
        self._sessions = sessions
        self._clock = clock

    async def login(
        self, db: AsyncSession, username: str, password: str
    ) -> tuple[User, UserSession, str]:
        """Verify credentials and mint a session; returns (user, session, raw token)."""
        try:
            user = await self._users.get_by_username(db, username)
            if user is None or not verify_password(password, user.password_hash):
                raise not_authorized("Invalid username or password.")
            now = self._clock()
            raw_token = new_session_token()
            session = UserSession(
                user_id=user.id,
                token=hash_token(raw_token),
                expires_at=now + timedelta(hours=settings.session_expire_hours),
                created_at=now,
                last_seen_at=now,
            )
            await self._sessions.insert(db, session)
            await db.commit()
            return user, session, raw_token
        except Route53Error:
            await db.rollback()
            raise

    async def logout(self, db: AsyncSession, raw_token: str) -> None:
        token_hash = hash_token(raw_token)
        await self._sessions.delete_by_token(db, token_hash)
        await db.commit()

    async def resolve_session(self, db: AsyncSession, raw_token: str) -> tuple[User, UserSession]:
        """Cookie token -> (user, session); refreshes ``last_seen_at``.

        Raises NotAuthorized for unknown, malformed, or expired tokens.
        """
        session = await self._sessions.get_by_token(db, hash_token(raw_token))
        now = self._clock()
        if session is None or session.expires_at <= now:
            raise not_authorized("No active session.")
        user = await self._users.get_by_id(db, session.user_id)
        if user is None:
            raise not_authorized("No active session.")
        session.last_seen_at = now
        await db.commit()
        return user, session
