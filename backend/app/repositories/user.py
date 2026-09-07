"""User aggregate queries (docs/ARCHITECTURE.md §2: queries only, no rules)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


class UserRepository:
    async def get_by_id(self, db: AsyncSession, user_id: str) -> User | None:
        result = await db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def get_by_username(self, db: AsyncSession, username: str) -> User | None:
        result = await db.execute(select(User).where(User.username == username.lower()))
        return result.scalar_one_or_none()

    async def get_by_email(self, db: AsyncSession, email: str) -> User | None:
        result = await db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def insert(self, db: AsyncSession, user: User) -> User:
        db.add(user)
        await db.flush()
        return user

    async def count(self, db: AsyncSession) -> int:
        result = await db.execute(select(func.count()).select_from(User))
        return int(result.scalar_one())


user_repository = UserRepository()
