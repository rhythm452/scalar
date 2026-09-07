"""Service layer: transactions and domain rules (docs/ARCHITECTURE.md §6).

Each public method takes ``(db, actor, payload...)`` and commits or rolls
back exactly once; repositories stay query-only. Constructors accept
injected repositories and a clock so tests can freeze time.
"""

from app.services.auth import AuthService
from app.services.change import ChangeService
from app.services.hosted_zone import HostedZoneService
from app.services.record import ChangeResult, RecordService, RecordSetPayload
from app.services.tag import TagService


def build_default_services() -> tuple[
    AuthService, HostedZoneService, RecordService, ChangeService, TagService
]:
    """Wire the singletons with the default repositories and clock."""
    from datetime import UTC, datetime

    from app.repositories import (
        change_repository,
        hosted_zone_repository,
        record_repository,
        session_repository,
        tag_repository,
        user_repository,
    )

    def clock() -> datetime:
        return datetime.now(UTC)

    return (
        AuthService(users=user_repository, sessions=session_repository, clock=clock),
        HostedZoneService(
            zones=hosted_zone_repository,
            records=record_repository,
            tags=tag_repository,
            clock=clock,
        ),
        RecordService(
            zones=hosted_zone_repository,
            records=record_repository,
            changes=change_repository,
            clock=clock,
        ),
        ChangeService(changes=change_repository, clock=clock),
        TagService(zones=hosted_zone_repository, tags=tag_repository),
    )


__all__ = [
    "AuthService",
    "ChangeResult",
    "ChangeService",
    "HostedZoneService",
    "RecordService",
    "RecordSetPayload",
    "TagService",
    "build_default_services",
]
