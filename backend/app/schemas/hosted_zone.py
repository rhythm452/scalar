"""Hosted zone request/response schemas (docs/API.md §3).

Zone `type` is left unvalidated on the create body: the service already
raises `InvalidInput` for a bad value (docs/ROUTE53-DOMAIN-RULES.md), and a
schema-level check would silently swap that documented 400 for a 422. The
list-query `type` filter carries no such service-owned error path, so it
is validated here for a clean 422 instead of a silent empty result.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models import ZONE_TYPES
from app.schemas.common import PageEnvelope, one_of
from app.schemas.tag import TagItem

ZoneTypeFilter = Annotated[str, one_of(ZONE_TYPES)]


class HostedZoneListParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    search: str = ""
    type: ZoneTypeFilter | None = None
    page_size: int = Field(default=20, ge=1, le=100)
    next_token: str | None = None
    sort_by: Literal["name", "created_at", "record_set_count"] = "name"
    sort_order: Literal["asc", "desc"] = "asc"


class HostedZoneCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    type: str
    comment: str | None = None
    vpc_id: str | None = None
    vpc_region: str | None = None


class HostedZoneUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    comment: str | None = None


class HostedZoneListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    comment: str | None
    type: str
    record_set_count: int
    caller_reference: str
    created_at: datetime


class HostedZoneDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    comment: str | None
    type: str
    vpc_id: str | None
    vpc_region: str | None
    record_set_count: int
    caller_reference: str
    created_at: datetime
    updated_at: datetime


HostedZoneListResponse = PageEnvelope[HostedZoneListItem]


class HostedZoneCreateResponse(BaseModel):
    zone: HostedZoneDetail
    change: None = None


class HostedZoneUpdateResponse(BaseModel):
    zone: HostedZoneDetail


class HostedZoneGetResponse(BaseModel):
    zone: HostedZoneDetail
    tags: list[TagItem]
