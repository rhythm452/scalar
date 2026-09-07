"""Tag aggregate queries: list per resource and full-replace semantics."""

from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Tag


class TagRepository:
    async def list_for_resource(
        self, db: AsyncSession, resource_type: str, resource_id: str
    ) -> list[Tag]:
        result = await db.execute(
            select(Tag)
            .where(Tag.resource_type == resource_type, Tag.resource_id == resource_id)
            .order_by(Tag.key)
        )
        return list(result.scalars().all())

    async def delete_for_resource(
        self, db: AsyncSession, resource_type: str, resource_id: str
    ) -> None:
        await db.execute(
            delete(Tag).where(Tag.resource_type == resource_type, Tag.resource_id == resource_id)
        )

    async def insert_all(self, db: AsyncSession, tags: list[Tag]) -> list[Tag]:
        db.add_all(tags)
        await db.flush()
        return tags


tag_repository = TagRepository()
