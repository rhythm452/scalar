"""Change batch aggregate queries."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ChangeBatch, ChangeBatchItem


class ChangeRepository:
    async def insert(self, db: AsyncSession, batch: ChangeBatch) -> ChangeBatch:
        db.add(batch)
        await db.flush()
        return batch

    async def add_items(self, db: AsyncSession, items: list[ChangeBatchItem]) -> None:
        db.add_all(items)
        await db.flush()

    async def get_by_id(self, db: AsyncSession, change_id: str) -> ChangeBatch | None:
        result = await db.execute(select(ChangeBatch).where(ChangeBatch.id == change_id))
        return result.scalar_one_or_none()

    async def get_items(self, db: AsyncSession, change_batch_id: str) -> list[ChangeBatchItem]:
        result = await db.execute(
            select(ChangeBatchItem)
            .where(ChangeBatchItem.change_batch_id == change_batch_id)
            .order_by(ChangeBatchItem.id)
        )
        return list(result.scalars().all())

    async def change_id_exists(self, db: AsyncSession, change_id: str) -> bool:
        result = await db.execute(
            select(func.count()).select_from(ChangeBatch).where(ChangeBatch.id == change_id)
        )
        return int(result.scalar_one()) > 0


change_repository = ChangeRepository()
