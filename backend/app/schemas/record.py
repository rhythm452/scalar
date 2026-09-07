"""Record set request/response schemas (docs/API.md §4).

`type` is left unvalidated on write bodies: `app.core.rdata.REGISTRY`
raises `InvalidChangeBatch` (400) for an unsupported type, and a schema
check would swap that for a 422. `routing_policy` has no such service-owned
path (an unrecognised value would otherwise hit the DB CHECK constraint as
a raw 500), so it is validated here; the same holds for the list-query
`type`/`routing_policy` filters, which are plain filters with no domain
consequence either way.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models import RECORD_TYPES, ROUTING_POLICIES
from app.schemas.change import ChangeSummary
from app.schemas.common import PageEnvelope, one_of

RoutingPolicyField = Annotated[str, one_of(ROUTING_POLICIES)]
RecordTypeFilter = Annotated[str, one_of(RECORD_TYPES)]


class RecordListParams(BaseModel):
    model_config = ConfigDict(extra="forbid")

    search: str = ""
    type: RecordTypeFilter | None = None
    routing_policy: RoutingPolicyField | None = None
    alias_only: bool = False
    page_size: int = Field(default=50, ge=1, le=100)
    next_token: str | None = None
    sort_by: Literal["name", "type", "ttl", "created_at"] = "name"
    sort_order: Literal["asc", "desc"] = "asc"


class RecordSetWrite(BaseModel):
    """Shared shape for create (POST) and full-replace (PUT) bodies."""

    model_config = ConfigDict(extra="forbid")

    name: str
    type: str
    ttl: int | None = None
    routing_policy: RoutingPolicyField = "simple"
    set_identifier: str | None = None
    weight: int | None = None
    region: str | None = None
    failover: Literal["PRIMARY", "SECONDARY"] | None = None
    geo_continent: str | None = None
    geo_country: str | None = None
    geo_subdivision: str | None = None
    is_alias: bool = False
    alias_target: str | None = None
    alias_hosted_zone_id: str | None = None
    alias_evaluate_target_health: bool = False
    values: list[str] = Field(default_factory=list)


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    type: str
    ttl: int | None
    routing_policy: str
    set_identifier: str | None
    weight: int | None
    region: str | None
    failover: str | None
    geo_continent: str | None
    geo_country: str | None
    geo_subdivision: str | None
    values: list[str] = Field(default_factory=list)
    is_alias: bool
    alias_target: str | None
    alias_hosted_zone_id: str | None
    alias_evaluate_target_health: bool | None
    is_system: bool
    created_at: datetime
    updated_at: datetime


RecordListResponse = PageEnvelope[RecordOut]


class RecordWriteResponse(BaseModel):
    record: RecordOut
    change: ChangeSummary


class RecordDeleteResponse(BaseModel):
    change: ChangeSummary


class BatchChangeItem(BaseModel):
    """`action` and `record`/`record_id` are left unvalidated: the service's
    `batch()` raises the documented `InvalidChangeBatch` messages for a bad
    action or a missing payload, and pre-empting that here would just
    produce a differently-worded 422 for the same failure."""

    model_config = ConfigDict(extra="forbid")

    action: str
    record: RecordSetWrite | None = None
    record_id: str | None = None


class BatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    comment: str | None = None
    changes: list[BatchChangeItem] = Field(default_factory=list, max_length=100)


class BatchResultItem(BaseModel):
    action: str
    record_id: str | None = None
    error: str | None = None


class BatchResponse(BaseModel):
    change: ChangeSummary
    results: list[BatchResultItem]
