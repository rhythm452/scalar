"""Session aggregate queries."""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserSession


class SessionRepository:
    async def get_by_token(self, db: AsyncSession, token_hash: str) -> UserSession | None:
        result = await db.execute(select(UserSession).where(UserSession.token == token_hash))
        return result.scalar_one_or_none()

    async def get_by_id(self, db: AsyncSession, session_id: str) -> UserSession | None:
        result = await db.execute(select(UserSession).where(UserSession.id == session_id))
        return result.scalar_one_or_none()

    async def insert(self, db: AsyncSession, session: UserSession) -> UserSession:
        db.add(session)
        await db.flush()
        return session

    async def delete(self, db: AsyncSession, session: UserSession) -> None:
        await db.delete(session)
        await db.flush()

    async def delete_by_token(self, db: AsyncSession, token_hash: str) -> None:
        await db.execute(delete(UserSession).where(UserSession.token == token_hash))


session_repository = SessionRepository()
