"""Record set endpoints (docs/API.md §4)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession, RecordServiceDep
from app.core.errors import invalid_change_batch
from app.models import ResourceRecordSet
from app.repositories import record_repository
from app.schemas.change import ChangeSummary
from app.schemas.record import (
    BatchChangeItem,
    BatchRequest,
    BatchResponse,
    BatchResultItem,
    RecordDeleteResponse,
    RecordListParams,
    RecordListResponse,
    RecordOut,
    RecordSetWrite,
    RecordWriteResponse,
)
from app.services.record import RecordSetPayload

router = APIRouter(prefix="/hostedzones/{zone_id}/rrsets", tags=["records"])


def _to_payload(body: RecordSetWrite) -> RecordSetPayload:
    return RecordSetPayload(
        name=body.name,
        type=body.type,
        ttl=body.ttl,
        routing_policy=body.routing_policy,
        set_identifier=body.set_identifier,
        weight=body.weight,
        region=body.region,
        failover=body.failover,
        geo_continent=body.geo_continent,
        geo_country=body.geo_country,
        geo_subdivision=body.geo_subdivision,
        is_alias=body.is_alias,
        alias_target=body.alias_target,
        alias_hosted_zone_id=body.alias_hosted_zone_id,
        alias_evaluate_target_health=body.alias_evaluate_target_health,
        values=body.values,
    )


async def _record_out(record: ResourceRecordSet, db: DbSession) -> RecordOut:
    values_by_id = await record_repository.get_values_for(db, [record.id])
    out = RecordOut.model_validate(record)
    return out.model_copy(update={"values": values_by_id.get(record.id, [])})


@router.get("", response_model=RecordListResponse)
async def list_records(
    zone_id: str,
    params: Annotated[RecordListParams, Query()],
    db: DbSession,
    current_user: CurrentUser,
    records: RecordServiceDep,
) -> RecordListResponse:
    rows, next_token = await records.list(
        db,
        current_user,
        zone_id,
        search=params.search,
        record_type=params.type,
        routing_policy=params.routing_policy,
        alias_only=params.alias_only,
        sort_by=params.sort_by,
        sort_order=params.sort_order,
        page_size=params.page_size,
        next_token=params.next_token,
    )
    values_by_id = await record_repository.get_values_for(db, [r.id for r in rows])
    items = [
        RecordOut.model_validate(r).model_copy(update={"values": values_by_id.get(r.id, [])})
        for r in rows
    ]
    return RecordListResponse(items=items, next_token=next_token)


@router.post("", response_model=RecordWriteResponse, status_code=201)
async def create_record(
    zone_id: str,
    body: RecordSetWrite,
    db: DbSession,
    current_user: CurrentUser,
    records: RecordServiceDep,
) -> RecordWriteResponse:
    record, change = await records.create(db, current_user, zone_id, _to_payload(body))
    return RecordWriteResponse(
        record=await _record_out(record, db), change=ChangeSummary.model_validate(change)
    )


@router.put("/{record_id}", response_model=RecordWriteResponse)
async def update_record(
    zone_id: str,
    record_id: str,
    body: RecordSetWrite,
    db: DbSession,
    current_user: CurrentUser,
    records: RecordServiceDep,
) -> RecordWriteResponse:
    record, change = await records.update(db, current_user, zone_id, record_id, _to_payload(body))
    return RecordWriteResponse(
        record=await _record_out(record, db), change=ChangeSummary.model_validate(change)
    )


@router.delete("/{record_id}", response_model=RecordDeleteResponse)
async def delete_record(
    zone_id: str,
    record_id: str,
    db: DbSession,
    current_user: CurrentUser,
    records: RecordServiceDep,
) -> RecordDeleteResponse:
    change = await records.delete(db, current_user, zone_id, record_id)
    return RecordDeleteResponse(change=ChangeSummary.model_validate(change))


@router.post("/batch", response_model=BatchResponse)
async def batch_records(
    zone_id: str,
    body: BatchRequest,
    db: DbSession,
    current_user: CurrentUser,
    records: RecordServiceDep,
) -> BatchResponse:
    items: list[tuple[str, RecordSetPayload | str]] = []
    for item in body.changes:
        if item.action == "DELETE":
            if not item.record_id:
                raise invalid_change_batch("Action DELETE requires a record_id.")
            items.append((item.action, item.record_id))
        else:
            if item.record is None:
                raise invalid_change_batch(f"Action {item.action} requires a record payload.")
            items.append((item.action, _to_payload(item.record)))

    change = await records.batch(db, current_user, zone_id, items, comment=body.comment)
    results = [
        BatchResultItem(action=resolved[0], record_id=_result_record_id(item, resolved))
        for item, resolved in zip(body.changes, items, strict=True)
    ]
    return BatchResponse(change=ChangeSummary.model_validate(change), results=results)


def _result_record_id(
    original: BatchChangeItem, resolved: tuple[str, RecordSetPayload | str]
) -> str | None:
    """`record_id` is documented optional (docs/API.md §4): DELETE echoes
    the id the caller supplied; RecordService.batch() doesn't return the
    ids it assigns to CREATE/UPSERT rows, so those are omitted rather than
    reached into the service for a value it doesn't expose."""
    _, target = resolved
    return target if isinstance(target, str) else original.record_id
