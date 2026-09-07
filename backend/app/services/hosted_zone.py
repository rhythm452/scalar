"""Hosted zone service: R1 auto NS/SOA, R3 delete guard, R9 duplicates, R10 comments.

Owns transactions and the full rule chain per docs/ARCHITECTURE.md §6 and
docs/ROUTE53-DOMAIN-RULES.md; repositories stay query-only.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dns_names import InvalidName, normalise_zone_name
from app.core.errors import (
    Route53Error,
    hosted_zone_already_exists,
    hosted_zone_not_empty,
    invalid_input,
    no_such_hosted_zone,
)
from app.core.ids import new_caller_reference, new_hosted_zone_id
from app.models import HostedZone, ResourceRecordSet, User
from app.repositories import HostedZoneRepository, RecordRepository, TagRepository


def default_clock() -> datetime:
    return datetime.now(UTC)


DEFAULT_CLOCK: Callable[[], datetime] = default_clock

R1_NS_TTL = 172800
R1_SOA_TTL = 900
R1_NS_TARGETS: tuple[str, ...] = (
    "ns-2048.awsdns-64.com.",
    "ns-2049.awsdns-65.net.",
    "ns-2050.awsdns-66.org.",
    "ns-2051.awsdns-67.co.uk.",
)
R1_SOA_VALUE = "ns-2048.awsdns-64.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"
COMMENT_MAX = 256
ID_COLLISION_ATTEMPTS = 5


class HostedZoneService:
    def __init__(
        self,
        *,
        zones: HostedZoneRepository,
        records: RecordRepository,
        tags: TagRepository,
        clock: Callable[[], datetime] = DEFAULT_CLOCK,
    ) -> None:
        self._zones = zones
        self._records = records
        self._tags = tags
        self._clock = clock

    async def create(
        self,
        db: AsyncSession,
        actor: User,
        *,
        name: str,
        zone_type: str,
        comment: str | None = None,
        vpc_id: str | None = None,
        vpc_region: str | None = None,
        caller_reference: str | None = None,
    ) -> HostedZone:
        """Create a zone plus its R1 system records in one transaction."""
        try:
            if zone_type not in ("public", "private"):
                raise invalid_input("Invalid hosted zone type.")
            if zone_type == "private" and (not vpc_id or not vpc_region):
                raise invalid_input("Private hosted zones require vpc_id and vpc_region.")
            if comment is not None and len(comment) > COMMENT_MAX:
                raise invalid_input("Description must be 256 characters or fewer.")
            try:
                normalised_name = normalise_zone_name(name)
            except InvalidName:
                raise invalid_input("Invalid domain name.") from None

            if await self._zones.exists_for_owner(db, actor.id, normalised_name, zone_type):
                raise hosted_zone_already_exists(normalised_name, zone_type)

            now = self._clock()
            zone = HostedZone(
                name=normalised_name,
                comment=comment,
                type=zone_type,
                vpc_id=vpc_id if zone_type == "private" else None,
                vpc_region=vpc_region if zone_type == "private" else None,
                caller_reference=caller_reference or new_caller_reference(),
                record_set_count=2,
                owner_user_id=actor.id,
                created_at=now,
                updated_at=now,
            )
            for _ in range(ID_COLLISION_ATTEMPTS):
                zone.id = new_hosted_zone_id()
                if not await self._zones.zone_id_exists(db, zone.id):
                    break
            await self._zones.insert(db, zone)
            await self._insert_system_records(db, zone)
            await db.commit()
            return zone
        except Route53Error:
            await db.rollback()
            raise

    async def _insert_system_records(self, db: AsyncSession, zone: HostedZone) -> None:
        """R1: apex NS set (4 values) + apex SOA set, both is_system=1."""
        now = zone.created_at
        ns_set = ResourceRecordSet(
            hosted_zone_id=zone.id,
            name=zone.name,
            type="NS",
            ttl=R1_NS_TTL,
            routing_policy="simple",
            is_alias=0,
            is_system=1,
            created_at=now,
            updated_at=now,
        )
        await self._records.insert(db, ns_set)
        await self._records.add_values(db, ns_set.id, list(R1_NS_TARGETS))
        soa_set = ResourceRecordSet(
            hosted_zone_id=zone.id,
            name=zone.name,
            type="SOA",
            ttl=R1_SOA_TTL,
            routing_policy="simple",
            is_alias=0,
            is_system=1,
            created_at=now,
            updated_at=now,
        )
        await self._records.insert(db, soa_set)
        await self._records.add_values(db, soa_set.id, [R1_SOA_VALUE])

    async def get(self, db: AsyncSession, actor: User, zone_id: str) -> HostedZone:
        zone = await self._zones.get_owned(db, actor.id, zone_id)
        if zone is None:
            raise no_such_hosted_zone(zone_id)
        return zone

    async def list(
        self,
        db: AsyncSession,
        actor: User,
        *,
        search: str = "",
        zone_type: str | None = None,
        sort_by: str = "name",
        sort_order: str = "asc",
        page_size: int = 20,
        next_token: str | None = None,
    ) -> tuple[list[HostedZone], str | None]:
        return await self._zones.search(
            db,
            actor.id,
            search=search,
            zone_type=zone_type,
            sort_by=sort_by,
            sort_order=sort_order,
            page_size=page_size,
            next_token=next_token,
        )

    async def update_comment(
        self, db: AsyncSession, actor: User, zone_id: str, comment: str | None
    ) -> HostedZone:
        try:
            zone = await self.get(db, actor, zone_id)
            if comment is not None and len(comment) > COMMENT_MAX:
                raise invalid_input("Description must be 256 characters or fewer.")
            zone.comment = comment
            zone.updated_at = self._clock()
            await db.commit()
            return zone
        except Route53Error:
            await db.rollback()
            raise

    async def delete(self, db: AsyncSession, actor: User, zone_id: str) -> None:
        """R3: reject while non-system records exist; tags are service-owned."""
        try:
            zone = await self.get(db, actor, zone_id)
            if await self._zones.count_non_system_records(db, zone.id) > 0:
                raise hosted_zone_not_empty()
            await self._tags.delete_for_resource(db, "hostedzone", zone.id)
            await self._zones.delete(db, zone)
            await db.commit()
        except Route53Error:
            await db.rollback()
            raise
