"""Record set + value aggregate queries: filters, search across values, pagination."""

from __future__ import annotations

from typing import Any, Final

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.models import ResourceRecordSet, ResourceRecordValue
from app.models.base import utc_to_storage
from app.repositories.pagination import (
    SortValue,
    cursor_filter,
    decode_token,
    page_result,
)

SORT_COLUMNS: Final[dict[str, InstrumentedAttribute[Any]]] = {
    "name": ResourceRecordSet.name,
    "type": ResourceRecordSet.type,
    "ttl": ResourceRecordSet.ttl,
    "created_at": ResourceRecordSet.created_at,
}

ID_COLUMN: Final = ResourceRecordSet.id


class RecordRepository:
    async def insert(self, db: AsyncSession, record: ResourceRecordSet) -> ResourceRecordSet:
        db.add(record)
        await db.flush()
        return record

    async def add_values(self, db: AsyncSession, record_set_id: str, values: list[str]) -> None:
        for order, value in enumerate(values):
            db.add(ResourceRecordValue(record_set_id=record_set_id, value=value, sort_order=order))
        await db.flush()

    async def get_values_for(
        self, db: AsyncSession, record_set_ids: list[str]
    ) -> dict[str, list[str]]:
        """Ordered values grouped by record set id, for list enrichment."""
        if not record_set_ids:
            return {}
        statement = (
            select(ResourceRecordValue)
            .where(ResourceRecordValue.record_set_id.in_(record_set_ids))
            .order_by(
                ResourceRecordValue.record_set_id,
                ResourceRecordValue.sort_order,
                ResourceRecordValue.id,
            )
        )
        grouped: dict[str, list[str]] = {}
        for value_row in (await db.execute(statement)).scalars():
            grouped.setdefault(value_row.record_set_id, []).append(value_row.value)
        return grouped

    async def get_by_id(self, db: AsyncSession, record_id: str) -> ResourceRecordSet | None:
        result = await db.execute(
            select(ResourceRecordSet).where(ResourceRecordSet.id == record_id)
        )
        return result.scalar_one_or_none()

    async def get_in_zone(
        self, db: AsyncSession, zone_id: str, record_id: str
    ) -> ResourceRecordSet | None:
        result = await db.execute(
            select(ResourceRecordSet).where(
                ResourceRecordSet.id == record_id,
                ResourceRecordSet.hosted_zone_id == zone_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_natural_key(
        self,
        db: AsyncSession,
        zone_id: str,
        name: str,
        record_type: str,
        set_identifier: str | None,
    ) -> ResourceRecordSet | None:
        conditions: list[ColumnElement[bool]] = [
            ResourceRecordSet.hosted_zone_id == zone_id,
            ResourceRecordSet.name == name,
            ResourceRecordSet.type == record_type,
        ]
        if set_identifier is None:
            conditions.append(ResourceRecordSet.set_identifier.is_(None))
        else:
            conditions.append(ResourceRecordSet.set_identifier == set_identifier)
        result = await db.execute(select(ResourceRecordSet).where(*conditions))
        return result.scalar_one_or_none()

    async def get_at_name(
        self, db: AsyncSession, zone_id: str, name: str
    ) -> list[ResourceRecordSet]:
        """All record sets sharing a name in a zone, for the R4 CNAME check."""
        result = await db.execute(
            select(ResourceRecordSet).where(
                ResourceRecordSet.hosted_zone_id == zone_id,
                ResourceRecordSet.name == name,
            )
        )
        return list(result.scalars().all())

    async def count_all_in_zone(self, db: AsyncSession, zone_id: str) -> int:
        result = await db.execute(
            select(func.count())
            .select_from(ResourceRecordSet)
            .where(ResourceRecordSet.hosted_zone_id == zone_id)
        )
        return int(result.scalar_one())

    async def delete(self, db: AsyncSession, record: ResourceRecordSet) -> None:
        await db.delete(record)
        await db.flush()

    async def delete_values(self, db: AsyncSession, record_set_id: str) -> None:
        statement = select(ResourceRecordValue).where(
            ResourceRecordValue.record_set_id == record_set_id
        )
        for value_row in (await db.execute(statement)).scalars():
            await db.delete(value_row)
        await db.flush()

    async def search(
        self,
        db: AsyncSession,
        zone_id: str,
        *,
        search: str = "",
        record_type: str | None = None,
        routing_policy: str | None = None,
        alias_only: bool = False,
        sort_by: str = "name",
        sort_order: str = "asc",
        page_size: int = 50,
        next_token: str | None = None,
    ) -> tuple[list[ResourceRecordSet], str | None]:
        """Zone-scoped record list per docs/API.md §4: substring on name or
        any value, exact type/policy filters, alias_only, cursor pagination."""
        sort_column = SORT_COLUMNS.get(sort_by)
        if sort_column is None:
            raise ValueError(f"Unsupported sort key: {sort_by}")
        ascending = sort_order == "asc"

        conditions: list[ColumnElement[bool]] = [ResourceRecordSet.hosted_zone_id == zone_id]
        if search:
            # EXISTS over a non-aggregate select: EXISTS(SELECT count(*) ...)
            # is always true (an aggregate always returns exactly one row,
            # even count=0), which silently made this match every record.
            value_match = (
                select(ResourceRecordValue.id)
                .where(
                    ResourceRecordValue.record_set_id == ResourceRecordSet.id,
                    ResourceRecordValue.value.like(f"%{search}%"),
                )
                .exists()
            )
            conditions.append(ResourceRecordSet.name.like(f"%{search}%") | value_match)
        if record_type is not None:
            conditions.append(ResourceRecordSet.type == record_type)
        if routing_policy is not None:
            conditions.append(ResourceRecordSet.routing_policy == routing_policy)
        if alias_only:
            conditions.append(ResourceRecordSet.is_alias == 1)
        if next_token is not None:
            sort_value, item_id = decode_token(next_token)
            conditions.append(
                cursor_filter(sort_column, ID_COLUMN, sort_value, item_id, ascending=ascending)
            )

        statement = (
            select(ResourceRecordSet)
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
            if sort_by == "ttl":
                value = int(last.ttl) if last.ttl is not None else 0
            elif sort_by == "created_at":
                value = utc_to_storage(last.created_at)
            elif sort_by == "type":
                value = str(last.type)
            else:
                value = str(last.name)
            return value, str(last.id)

        return page_result(rows, page_size, last_item)


record_repository = RecordRepository()
