"""Record service: R2 system-record guard, R4 CNAME coexistence, R5 name
normalisation, R6 TTL/alias, R7 per-type validation, R8 set identifiers,
R11 change batches.

Rule chain order for every write (docs/ARCHITECTURE.md §3.4 write
lifecycle): normalise name -> zone membership -> CNAME coexistence ->
TTL/alias -> per-type values -> set identifier -> write rows + change
batch + record_set_count in one transaction.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dns_names import InvalidName, is_within_zone, normalise
from app.core.errors import (
    Route53Error,
    invalid_change_batch,
    no_such_hosted_zone,
    no_such_record,
)
from app.core.ids import new_change_id
from app.core.rdata import validate_values
from app.models import (
    ChangeBatch,
    ChangeBatchItem,
    HostedZone,
    ResourceRecordSet,
    User,
)
from app.repositories import (
    ChangeRepository,
    HostedZoneRepository,
    RecordRepository,
)


def default_clock() -> datetime:
    return datetime.now(UTC)


DEFAULT_CLOCK: Callable[[], datetime] = default_clock

TTL_MIN = 1
TTL_MAX = 2147483647
SOA_TYPE = "SOA"
BATCH_MAX_ITEMS = 100
ID_COLLISION_ATTEMPTS = 5

Snapshots = list[tuple[str, "dict[str, object]"]]
BatchItems = list[tuple[str, "RecordSetPayload | str"]]


@dataclass(slots=True)
class RecordSetPayload:
    """Plain payload from the API layer; Phase 2 routers build it from
    Pydantic bodies, tests build it directly."""

    name: str
    type: str
    ttl: int | None = None
    routing_policy: str = "simple"
    set_identifier: str | None = None
    weight: int | None = None
    region: str | None = None
    failover: str | None = None
    geo_continent: str | None = None
    geo_country: str | None = None
    geo_subdivision: str | None = None
    is_alias: bool = False
    alias_target: str | None = None
    alias_hosted_zone_id: str | None = None
    alias_evaluate_target_health: bool = False
    values: list[str] = field(default_factory=list)


@dataclass(slots=True)
class ValidatedRecord:
    """Outcome of the R4-R8 validation chain."""

    name: str
    values: list[str]
    ttl: int | None
    set_identifier: str | None
    is_alias: int
    alias_target: str | None
    alias_hosted_zone_id: str | None
    alias_evaluate_target_health: int | None


@dataclass(slots=True)
class ChangeResult:
    """The R11 payload returned by every record write."""

    id: str
    status: str
    submitted_at: datetime


class RecordService:
    def __init__(
        self,
        *,
        zones: HostedZoneRepository,
        records: RecordRepository,
        changes: ChangeRepository,
        clock: Callable[[], datetime] = DEFAULT_CLOCK,
    ) -> None:
        self._zones = zones
        self._records = records
        self._changes = changes
        self._clock = clock

    # ---------------------------------------------------------------- reads

    async def get(
        self, db: AsyncSession, actor: User, zone_id: str, record_id: str
    ) -> ResourceRecordSet:
        await self._owned_zone(db, actor, zone_id)
        record = await self._records.get_in_zone(db, zone_id, record_id)
        if record is None:
            raise no_such_record(record_id)
        return record

    async def list(
        self,
        db: AsyncSession,
        actor: User,
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
        await self._owned_zone(db, actor, zone_id)
        return await self._records.search(
            db,
            zone_id,
            search=search,
            record_type=record_type,
            routing_policy=routing_policy,
            alias_only=alias_only,
            sort_by=sort_by,
            sort_order=sort_order,
            page_size=page_size,
            next_token=next_token,
        )

    # --------------------------------------------------------------- writes

    async def create(
        self, db: AsyncSession, actor: User, zone_id: str, payload: RecordSetPayload
    ) -> tuple[ResourceRecordSet, ChangeResult]:
        try:
            zone = await self._owned_zone(db, actor, zone_id)
            now = self._clock()
            record = await self._apply_create(db, zone, payload, now)
            change = await self._record_change(
                db, zone, [("CREATE", self._snapshot(record))], now=now
            )
            await db.commit()
            return record, change
        except Route53Error:
            await db.rollback()
            raise

    async def update(
        self,
        db: AsyncSession,
        actor: User,
        zone_id: str,
        record_id: str,
        payload: RecordSetPayload,
    ) -> tuple[ResourceRecordSet, ChangeResult]:
        """Full replace. System records (R2 note in docs/API.md §4): TTL and
        values editable; type/name changes rejected; delete forbidden."""
        try:
            zone = await self._owned_zone(db, actor, zone_id)
            existing = await self._records.get_in_zone(db, zone_id, record_id)
            if existing is None:
                raise no_such_record(record_id)
            now = self._clock()
            if existing.is_system:
                record = await self._apply_system_update(db, zone, existing, payload, now)
            else:
                record = await self._apply_update(db, zone, existing, payload, now)
            change = await self._record_change(
                db, zone, [("UPSERT", self._snapshot(record))], now=now
            )
            await db.commit()
            return record, change
        except Route53Error:
            await db.rollback()
            raise

    async def delete(
        self, db: AsyncSession, actor: User, zone_id: str, record_id: str
    ) -> ChangeResult:
        try:
            zone = await self._owned_zone(db, actor, zone_id)
            record = await self._records.get_in_zone(db, zone_id, record_id)
            if record is None:
                raise no_such_record(record_id)
            if record.is_system:
                raise self._system_delete_error(record)
            now = self._clock()
            snapshot = self._snapshot(record)
            await self._records.delete(db, record)
            zone.record_set_count -= 1
            zone.updated_at = now
            change = await self._record_change(db, zone, [("DELETE", snapshot)], now=now)
            await db.commit()
            return change
        except Route53Error:
            await db.rollback()
            raise

    async def batch(
        self,
        db: AsyncSession,
        actor: User,
        zone_id: str,
        items: BatchItems,
        *,
        comment: str | None = None,
    ) -> ChangeResult:
        """Apply CREATE/UPSERT/DELETE items atomically: any item failure
        rolls the entire batch back (docs/API.md §4). DELETE targets carry
        a record id; CREATE/UPSERT carry a payload."""
        try:
            zone = await self._owned_zone(db, actor, zone_id)
            if not items:
                raise invalid_change_batch("Changes must contain at least one item.")
            if len(items) > BATCH_MAX_ITEMS:
                raise invalid_change_batch(f"Changes must contain at most {BATCH_MAX_ITEMS} items.")
            now = self._clock()
            snapshots: Snapshots = []
            for action, target in items:
                if action == "DELETE":
                    record = await self._records.get_in_zone(
                        db, zone_id, target if isinstance(target, str) else ""
                    )
                    if record is None:
                        raise no_such_record(target if isinstance(target, str) else "")
                    if record.is_system:
                        raise self._system_delete_error(record)
                    snapshots.append(("DELETE", self._snapshot(record)))
                    await self._records.delete(db, record)
                    zone.record_set_count -= 1
                elif action in ("CREATE", "UPSERT"):
                    if not isinstance(target, RecordSetPayload):
                        raise invalid_change_batch(f"Action {action} requires a record payload.")
                    if action == "CREATE":
                        record = await self._apply_create(db, zone, target, now)
                    else:
                        record = await self._apply_upsert(db, zone, target, now)
                    snapshots.append((action, self._snapshot(record)))
                else:
                    raise invalid_change_batch(f"Invalid action {action}.")
            zone.updated_at = now
            change = await self._record_change(db, zone, snapshots, comment=comment, now=now)
            await db.commit()
            return change
        except Route53Error:
            await db.rollback()
            raise

    # ------------------------------------------------------------- internals

    async def _owned_zone(self, db: AsyncSession, actor: User, zone_id: str) -> HostedZone:
        zone = await self._zones.get_owned(db, actor.id, zone_id)
        if zone is None:
            raise no_such_hosted_zone(zone_id)
        return zone

    @staticmethod
    def _system_delete_error(record: ResourceRecordSet) -> Route53Error:
        if record.type == "NS":
            return invalid_change_batch(
                "System record of type NS at the zone apex cannot be deleted."
            )
        return invalid_change_batch("System record of type SOA cannot be deleted.")

    async def _validate(
        self,
        db: AsyncSession,
        zone: HostedZone,
        payload: RecordSetPayload,
        *,
        exclude_id: str | None = None,
    ) -> ValidatedRecord:
        """Run the R4-R8 chain and return the normalised result."""
        # R5: normalise + zone membership.
        try:
            name = normalise(payload.name, zone=zone.name)
        except InvalidName as exc:
            raise invalid_change_batch(str(exc)) from None
        if not is_within_zone(name, zone.name):
            raise invalid_change_batch(
                f"RRSet with DNS name {name} is not permitted in zone {zone.name}."
            )

        # R7: SOA cannot be created directly.
        if payload.type == SOA_TYPE:
            raise invalid_change_batch(
                "SOA records are managed automatically and cannot be created directly."
            )

        # R4: CNAME coexistence. A CNAME conflicts with ANY other set at the
        # same name; any other type conflicts with an existing CNAME. The apex
        # system NS/SOA never block non-CNAME sets at the apex.
        conflicting = await self._records.get_at_name(db, zone.id, name)
        for other in conflicting:
            if exclude_id is not None and other.id == exclude_id:
                continue
            if other.type == payload.type:
                continue
            if payload.type == "CNAME" or other.type == "CNAME":
                raise invalid_change_batch(
                    f"RRSet of type {payload.type} with DNS name {name} is not "
                    "permitted because a conflicting RRSet exists."
                )

        # R6: TTL vs alias.
        ttl: int | None
        values: list[str]
        is_alias = int(payload.is_alias)
        alias_target: str | None = None
        alias_zone: str | None = None
        alias_health: int | None = None
        if payload.is_alias:
            if payload.ttl is not None:
                raise invalid_change_batch("Alias records must not specify TTL.")
            if not payload.alias_target:
                raise invalid_change_batch("AliasTarget is required for alias records.")
            try:
                alias_target = normalise(payload.alias_target)
            except InvalidName:
                raise invalid_change_batch("AliasTarget is not a valid DNS name.") from None
            alias_zone = payload.alias_hosted_zone_id
            alias_health = int(payload.alias_evaluate_target_health)
            ttl = None
            values = []
        else:
            if payload.ttl is None or not TTL_MIN <= payload.ttl <= TTL_MAX:
                raise invalid_change_batch("TTL is required for non-alias records.")
            ttl = payload.ttl
            values = validate_values(payload.type, payload.values)

        # R8: set identifiers for non-simple routing.
        set_identifier: str | None = None
        if payload.routing_policy != "simple":
            set_identifier = (payload.set_identifier or "").strip()
            if not set_identifier:
                raise invalid_change_batch(
                    "SetIdentifier is required for non-simple routing policies."
                )
        duplicate = await self._records.get_by_natural_key(
            db, zone.id, name, payload.type, set_identifier
        )
        if duplicate is not None and duplicate.id != exclude_id:
            if set_identifier is None:
                raise invalid_change_batch(
                    f"A record set with name {name}, type {payload.type} already exists."
                )
            raise invalid_change_batch(
                f"A record set with name {name}, type {payload.type}, "
                f"and identifier {set_identifier} already exists."
            )
        return ValidatedRecord(
            name=name,
            values=values,
            ttl=ttl,
            set_identifier=set_identifier,
            is_alias=is_alias,
            alias_target=alias_target,
            alias_hosted_zone_id=alias_zone,
            alias_evaluate_target_health=alias_health,
        )

    async def _apply_create(
        self, db: AsyncSession, zone: HostedZone, payload: RecordSetPayload, now: datetime
    ) -> ResourceRecordSet:
        checked = await self._validate(db, zone, payload)
        record = ResourceRecordSet(
            hosted_zone_id=zone.id,
            name=checked.name,
            type=payload.type,
            ttl=checked.ttl,
            routing_policy=payload.routing_policy,
            set_identifier=checked.set_identifier,
            weight=payload.weight,
            region=payload.region,
            failover=payload.failover,
            geo_continent=payload.geo_continent,
            geo_country=payload.geo_country,
            geo_subdivision=payload.geo_subdivision,
            is_alias=checked.is_alias,
            alias_target=checked.alias_target,
            alias_hosted_zone_id=checked.alias_hosted_zone_id,
            alias_evaluate_target_health=checked.alias_evaluate_target_health,
            is_system=0,
            created_at=now,
            updated_at=now,
        )
        await self._records.insert(db, record)
        await self._records.add_values(db, record.id, checked.values)
        zone.record_set_count += 1
        zone.updated_at = now
        return record

    async def _apply_update(
        self,
        db: AsyncSession,
        zone: HostedZone,
        existing: ResourceRecordSet,
        payload: RecordSetPayload,
        now: datetime,
    ) -> ResourceRecordSet:
        checked = await self._validate(db, zone, payload, exclude_id=existing.id)
        existing.name = checked.name
        existing.type = payload.type
        existing.ttl = checked.ttl
        existing.routing_policy = payload.routing_policy
        existing.set_identifier = checked.set_identifier
        existing.weight = payload.weight
        existing.region = payload.region
        existing.failover = payload.failover
        existing.geo_continent = payload.geo_continent
        existing.geo_country = payload.geo_country
        existing.geo_subdivision = payload.geo_subdivision
        existing.is_alias = checked.is_alias
        existing.alias_target = checked.alias_target
        existing.alias_hosted_zone_id = checked.alias_hosted_zone_id
        existing.alias_evaluate_target_health = checked.alias_evaluate_target_health
        existing.updated_at = now
        await self._records.delete_values(db, existing.id)
        await self._records.add_values(db, existing.id, checked.values)
        zone.updated_at = now
        return existing

    async def _apply_upsert(
        self, db: AsyncSession, zone: HostedZone, payload: RecordSetPayload, now: datetime
    ) -> ResourceRecordSet:
        """UPSERT: replace when the natural key exists, else create."""
        checked = await self._validate(db, zone, payload)
        existing = await self._records.get_by_natural_key(
            db, zone.id, checked.name, payload.type, checked.set_identifier
        )
        if existing is not None:
            return await self._apply_update(db, zone, existing, payload, now)
        return await self._apply_create(db, zone, payload, now)

    async def _apply_system_update(
        self,
        db: AsyncSession,
        zone: HostedZone,
        existing: ResourceRecordSet,
        payload: RecordSetPayload,
        now: datetime,
    ) -> ResourceRecordSet:
        """System records: only TTL and values are editable (docs/API.md §4)."""
        if payload.type != existing.type:
            raise invalid_change_batch("System record sets cannot change type.")
        try:
            name = normalise(payload.name, zone=zone.name)
        except InvalidName:
            raise invalid_change_batch("Invalid record name.") from None
        if name != existing.name:
            raise invalid_change_batch("System record sets cannot change their name.")
        if payload.is_alias:
            raise invalid_change_batch("System record sets cannot be alias records.")
        if payload.ttl is None or not TTL_MIN <= payload.ttl <= TTL_MAX:
            raise invalid_change_batch("TTL is required for non-alias records.")
        values = validate_values(existing.type, payload.values)
        existing.ttl = payload.ttl
        existing.updated_at = now
        await self._records.delete_values(db, existing.id)
        await self._records.add_values(db, existing.id, values)
        zone.updated_at = now
        return existing

    @staticmethod
    def _snapshot(record: ResourceRecordSet) -> dict[str, object]:
        return {
            "id": record.id,
            "hosted_zone_id": record.hosted_zone_id,
            "name": record.name,
            "type": record.type,
            "ttl": record.ttl,
            "routing_policy": record.routing_policy,
            "set_identifier": record.set_identifier,
            "is_alias": record.is_alias,
            "alias_target": record.alias_target,
            "is_system": record.is_system,
        }

    async def _record_change(
        self,
        db: AsyncSession,
        zone: HostedZone,
        snapshots: Snapshots,
        *,
        comment: str | None = None,
        now: datetime,
    ) -> ChangeResult:
        """R11: PENDING change batch + item snapshots in this transaction."""
        batch = ChangeBatch(
            hosted_zone_id=zone.id,
            status="PENDING",
            submitted_at=now,
            comment=comment,
        )
        for _ in range(ID_COLLISION_ATTEMPTS):
            batch.id = new_change_id()
            if not await self._changes.change_id_exists(db, batch.id):
                break
        await self._changes.insert(db, batch)
        await self._changes.add_items(
            db,
            [
                ChangeBatchItem(
                    change_batch_id=batch.id,
                    action=action,
                    record_snapshot=json.dumps(snapshot),
                )
                for action, snapshot in snapshots
            ],
        )
        return ChangeResult(id=batch.id, status=batch.status, submitted_at=now)
