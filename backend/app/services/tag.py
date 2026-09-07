"""Tag service: full-replace semantics on hosted zone tags.

docs/API.md §3: PUT replaces the whole tag set (max 50); keys 1-128 chars,
values max 256. Tags have no DB FK (health checks share the table), so the
service owns their lifecycle including deletion on zone delete.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Route53Error, invalid_input, no_such_hosted_zone
from app.models import Tag, User
from app.repositories import HostedZoneRepository, TagRepository

TAG_KEY_MIN = 1
TAG_KEY_MAX = 128
TAG_VALUE_MAX = 256
TAGS_MAX = 50


class TagService:
    def __init__(self, *, zones: HostedZoneRepository, tags: TagRepository) -> None:
        self._zones = zones
        self._tags = tags

    async def list_for_zone(self, db: AsyncSession, actor: User, zone_id: str) -> list[Tag]:
        await self._owned_zone(db, actor, zone_id)
        return await self._tags.list_for_resource(db, "hostedzone", zone_id)

    async def replace_for_zone(
        self, db: AsyncSession, actor: User, zone_id: str, tags: list[dict[str, str]]
    ) -> list[Tag]:
        try:
            await self._owned_zone(db, actor, zone_id)
            if len(tags) > TAGS_MAX:
                raise invalid_input(f"A resource may have at most {TAGS_MAX} tags.")
            keys: set[str] = set()
            for tag in tags:
                key = tag.get("key", "")
                value = tag.get("value", "")
                if not TAG_KEY_MIN <= len(key) <= TAG_KEY_MAX:
                    raise invalid_input("Tag keys must be 1-128 characters.")
                if len(value) > TAG_VALUE_MAX:
                    raise invalid_input("Tag values must be 256 characters or fewer.")
                if key in keys:
                    raise invalid_input(f"Duplicate tag key {key}.")
                keys.add(key)
            await self._tags.delete_for_resource(db, "hostedzone", zone_id)
            rows = [
                Tag(resource_type="hostedzone", resource_id=zone_id, key=t["key"], value=t["value"])
                for t in tags
            ]
            if rows:
                await self._tags.insert_all(db, rows)
            await db.commit()
            return rows
        except Route53Error:
            await db.rollback()
            raise

    async def _owned_zone(self, db: AsyncSession, actor: User, zone_id: str) -> None:
        zone = await self._zones.get_owned(db, actor.id, zone_id)
        if zone is None:
            raise no_such_hosted_zone(zone_id)
        return None
