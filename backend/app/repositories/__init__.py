"""Query layer: single-aggregate queries with explicit method names.

Per docs/ARCHITECTURE.md §4 these modules never import services, never
commit, and contain no domain rules; transaction ownership and validation
live in the service layer.
"""

from app.repositories.change import ChangeRepository, change_repository
from app.repositories.hosted_zone import HostedZoneRepository, hosted_zone_repository
from app.repositories.pagination import (
    cursor_filter,
    decode_token,
    encode_token,
    page_result,
)
from app.repositories.record import RecordRepository, record_repository
from app.repositories.session import SessionRepository, session_repository
from app.repositories.tag import TagRepository, tag_repository
from app.repositories.user import UserRepository, user_repository

__all__ = [
    "ChangeRepository",
    "HostedZoneRepository",
    "RecordRepository",
    "SessionRepository",
    "TagRepository",
    "UserRepository",
    "change_repository",
    "cursor_filter",
    "decode_token",
    "encode_token",
    "hosted_zone_repository",
    "page_result",
    "record_repository",
    "session_repository",
    "tag_repository",
    "user_repository",
]
