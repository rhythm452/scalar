"""Hosted zone endpoints (docs/API.md §3)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.core.deps import CurrentUser, DbSession, TagServiceDep, ZoneServiceDep
from app.schemas.common import OkResponse
from app.schemas.hosted_zone import (
    HostedZoneCreate,
    HostedZoneCreateResponse,
    HostedZoneDetail,
    HostedZoneGetResponse,
    HostedZoneListItem,
    HostedZoneListParams,
    HostedZoneListResponse,
    HostedZoneUpdate,
    HostedZoneUpdateResponse,
)
from app.schemas.tag import TagItem, TagsReplaceRequest, TagsResponse

router = APIRouter(prefix="/hostedzones", tags=["hosted-zones"])


@router.get("", response_model=HostedZoneListResponse)
async def list_zones(
    params: Annotated[HostedZoneListParams, Query()],
    db: DbSession,
    current_user: CurrentUser,
    zones: ZoneServiceDep,
) -> HostedZoneListResponse:
    rows, next_token = await zones.list(
        db,
        current_user,
        search=params.search,
        zone_type=params.type,
        sort_by=params.sort_by,
        sort_order=params.sort_order,
        page_size=params.page_size,
        next_token=params.next_token,
    )
    return HostedZoneListResponse(
        items=[HostedZoneListItem.model_validate(z) for z in rows], next_token=next_token
    )


@router.post("", response_model=HostedZoneCreateResponse, status_code=201)
async def create_zone(
    body: HostedZoneCreate, db: DbSession, current_user: CurrentUser, zones: ZoneServiceDep
) -> HostedZoneCreateResponse:
    zone = await zones.create(
        db,
        current_user,
        name=body.name,
        zone_type=body.type,
        comment=body.comment,
        vpc_id=body.vpc_id,
        vpc_region=body.vpc_region,
    )
    return HostedZoneCreateResponse(zone=HostedZoneDetail.model_validate(zone))


@router.get("/{zone_id}", response_model=HostedZoneGetResponse)
async def get_zone(
    zone_id: str,
    db: DbSession,
    current_user: CurrentUser,
    zones: ZoneServiceDep,
    tags: TagServiceDep,
) -> HostedZoneGetResponse:
    zone = await zones.get(db, current_user, zone_id)
    zone_tags = await tags.list_for_zone(db, current_user, zone_id)
    return HostedZoneGetResponse(
        zone=HostedZoneDetail.model_validate(zone),
        tags=[TagItem.model_validate(t) for t in zone_tags],
    )


@router.patch("/{zone_id}", response_model=HostedZoneUpdateResponse)
async def update_zone(
    zone_id: str,
    body: HostedZoneUpdate,
    db: DbSession,
    current_user: CurrentUser,
    zones: ZoneServiceDep,
) -> HostedZoneUpdateResponse:
    zone = await zones.update_comment(db, current_user, zone_id, body.comment)
    return HostedZoneUpdateResponse(zone=HostedZoneDetail.model_validate(zone))


@router.delete("/{zone_id}", response_model=OkResponse)
async def delete_zone(
    zone_id: str, db: DbSession, current_user: CurrentUser, zones: ZoneServiceDep
) -> OkResponse:
    await zones.delete(db, current_user, zone_id)
    return OkResponse()


@router.get("/{zone_id}/tags", response_model=TagsResponse)
async def get_zone_tags(
    zone_id: str, db: DbSession, current_user: CurrentUser, tags: TagServiceDep
) -> TagsResponse:
    zone_tags = await tags.list_for_zone(db, current_user, zone_id)
    return TagsResponse(tags=[TagItem.model_validate(t) for t in zone_tags])


@router.put("/{zone_id}/tags", response_model=TagsResponse)
async def replace_zone_tags(
    zone_id: str,
    body: TagsReplaceRequest,
    db: DbSession,
    current_user: CurrentUser,
    tags: TagServiceDep,
) -> TagsResponse:
    zone_tags = await tags.replace_for_zone(
        db, current_user, zone_id, [{"key": t.key, "value": t.value} for t in body.tags]
    )
    return TagsResponse(tags=[TagItem.model_validate(t) for t in zone_tags])
