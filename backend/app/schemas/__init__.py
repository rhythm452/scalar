"""Pydantic request/response schemas, one module per aggregate (docs/API.md).

Never expose ORM models directly; routers translate between these and the
service layer.
"""

from app.schemas.auth import LoginRequest, LoginResponse, LogoutResponse, SessionResponse
from app.schemas.change import ChangeDetail, ChangeDetailResponse, ChangeSummary
from app.schemas.common import OkResponse, PageEnvelope
from app.schemas.error import ErrorDetail, ErrorEnvelope
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
from app.schemas.mocked import DashboardSummary, MockedListResponse
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
from app.schemas.tag import TagItem, TagsReplaceRequest, TagsResponse
from app.schemas.user import UserOut

__all__ = [
    "BatchChangeItem",
    "BatchRequest",
    "BatchResponse",
    "BatchResultItem",
    "ChangeDetail",
    "ChangeDetailResponse",
    "ChangeSummary",
    "DashboardSummary",
    "ErrorDetail",
    "ErrorEnvelope",
    "HostedZoneCreate",
    "HostedZoneCreateResponse",
    "HostedZoneDetail",
    "HostedZoneGetResponse",
    "HostedZoneListItem",
    "HostedZoneListParams",
    "HostedZoneListResponse",
    "HostedZoneUpdate",
    "HostedZoneUpdateResponse",
    "LoginRequest",
    "LoginResponse",
    "LogoutResponse",
    "MockedListResponse",
    "OkResponse",
    "PageEnvelope",
    "RecordDeleteResponse",
    "RecordListParams",
    "RecordListResponse",
    "RecordOut",
    "RecordSetWrite",
    "RecordWriteResponse",
    "SessionResponse",
    "TagItem",
    "TagsReplaceRequest",
    "TagsResponse",
    "UserOut",
]
