"""Hosted zone aggregate queries: owner-scoped search, filters, cursor pagination."""

from __future__ import annotations

from typing import Any, Final

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import HostedZone, ResourceRecordSet
from app.models.base import utc_to_storage
from app.repositories.pagination import (
    SortValue,
    cursor_filter,
    decode_token,
    page_result,
)

SORT_COLUMNS: Final[dict[str, Any]] = {
    "name": HostedZone.name,
    "created_at": HostedZone.created_at,
    "record_set_count": HostedZone.record_set_count,
}

ID_COLUMN: Final = HostedZone.id


class HostedZoneRepository:
    async def insert(self, db: AsyncSession, zone: HostedZone) -> HostedZone:
        db.add(zone)
        await db.flush()
        return zone

    async def get_by_id(self, db: AsyncSession, zone_id: str) -> HostedZone | None:
        result = await db.execute(select(HostedZone).where(HostedZone.id == zone_id))
        return result.scalar_one_or_none()

    async def get_owned(self, db: AsyncSession, owner_id: str, zone_id: str) -> HostedZone | None:
        result = await db.execute(
            select(HostedZone).where(HostedZone.id == zone_id, HostedZone.owner_user_id == owner_id)
        )
        return result.scalar_one_or_none()

    async def zone_id_exists(self, db: AsyncSession, zone_id: str) -> bool:
        result = await db.execute(
            select(func.count()).select_from(HostedZone).where(HostedZone.id == zone_id)
        )
        return int(result.scalar_one()) > 0

    async def exists_for_owner(
        self, db: AsyncSession, owner_id: str, name: str, zone_type: str
    ) -> bool:
        result = await db.execute(
            select(func.count())
            .select_from(HostedZone)
            .where(
                HostedZone.owner_user_id == owner_id,
                HostedZone.name == name,
                HostedZone.type == zone_type,
            )
        )
        return int(result.scalar_one()) > 0

    async def count_non_system_records(self, db: AsyncSession, zone_id: str) -> int:
        result = await db.execute(
            select(func.count())
            .select_from(ResourceRecordSet)
            .where(
                ResourceRecordSet.hosted_zone_id == zone_id,
                ResourceRecordSet.is_system == 0,
            )
        )
        return int(result.scalar_one())

    async def delete(self, db: AsyncSession, zone: HostedZone) -> None:
        await db.delete(zone)
        await db.flush()

    async def summary_for_owner(self, db: AsyncSession, owner_id: str) -> tuple[int, int]:
        """(zone_count, total_record_set_count) for the dashboard summary
        (docs/API.md §7); record_set_count is denormalized on the zone, so
        this is one aggregate query rather than a join through records."""
        result = await db.execute(
            select(func.count(), func.coalesce(func.sum(HostedZone.record_set_count), 0)).where(
                HostedZone.owner_user_id == owner_id
            )
        )
        zone_count, record_count = result.one()
        return int(zone_count), int(record_count)

    async def search(
        self,
        db: AsyncSession,
        owner_id: str,
        *,
        search: str = "",
        zone_type: str | None = None,
        sort_by: str = "name",
        sort_order: str = "asc",
        page_size: int = 20,
        next_token: str | None = None,
    ) -> tuple[list[HostedZone], str | None]:
        """Owner-scoped zone list per docs/API.md §3: substring on name,
        exact type filter, whitelisted sort keys, cursor pagination."""
        sort_column = SORT_COLUMNS.get(sort_by)
        if sort_column is None:
            raise ValueError(f"Unsupported sort key: {sort_by}")
        ascending = sort_order == "asc"

        conditions: list[ColumnElement[bool]] = [HostedZone.owner_user_id == owner_id]
        if search:
            conditions.append(HostedZone.name.like(f"%{search}%"))
        if zone_type is not None:
            conditions.append(HostedZone.type == zone_type)
        if next_token is not None:
            sort_value, item_id = decode_token(next_token)
            conditions.append(
                cursor_filter(sort_column, ID_COLUMN, sort_value, item_id, ascending=ascending)
            )

        statement = (
            select(HostedZone)
            .where(*conditions)
            .order_by(
                sort_column.asc() if ascending else sort_column.desc(),
                ID_COLUMN.asc() if ascending else ID_COLUMN.desc(),
            )
            .limit(page_size + 1)
        )
        rows = list((await db.execute(statement)).scalars().all())

        def last_item() -> tuple[SortValue, str]:
            last = rows[page_size - 1]
            value: SortValue
            if sort_by == "record_set_count":
                value = int(last.record_set_count)
            elif sort_by == "created_at":
                value = utc_to_storage(last.created_at)
            else:
                value = str(last.name)
            return value, str(last.id)

        return page_result(rows, page_size, last_item)


hosted_zone_repository = HostedZoneRepository()
