"""ORM models, one module per aggregate (docs/DATABASE.md)."""

from app.models.base import Base, UTCTimestamp, new_uuid, utcnow
from app.models.change import (
    CHANGE_ACTIONS,
    CHANGE_STATUSES,
    INSYNC_AFTER_SECONDS,
    ChangeBatch,
    ChangeBatchItem,
)
from app.models.hosted_zone import ZONE_TYPES, HostedZone
from app.models.record import (
    RECORD_TYPES,
    ROUTING_POLICIES,
    TTL_MAX,
    TTL_MIN,
    ResourceRecordSet,
    ResourceRecordValue,
)
from app.models.session import UserSession
from app.models.tag import TAGS_MAX_PER_RESOURCE, Tag
from app.models.user import User

__all__ = [
    "CHANGE_ACTIONS",
    "CHANGE_STATUSES",
    "INSYNC_AFTER_SECONDS",
    "RECORD_TYPES",
    "ROUTING_POLICIES",
    "TAGS_MAX_PER_RESOURCE",
    "TTL_MAX",
    "TTL_MIN",
    "ZONE_TYPES",
    "Base",
    "ChangeBatch",
    "ChangeBatchItem",
    "HostedZone",
    "ResourceRecordSet",
    "ResourceRecordValue",
    "Tag",
    "UTCTimestamp",
    "User",
    "UserSession",
    "new_uuid",
    "utcnow",
]
