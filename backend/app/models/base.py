"""Shared declarative base, timestamp type, and primary-key mixins.

Timestamps are stored as TEXT ISO-8601 UTC (``YYYY-MM-DDTHH:MM:SSZ``) per
docs/DATABASE.md §1, surfaced to Python as timezone-aware datetimes. Server
defaults exist so raw SQL inserts still get sane values, but the service
layer always sets timestamps explicitly so tests can freeze time.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Final

from sqlalchemy import MetaData, String, Text, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import TypeDecorator

NAMING_CONVENTION: Final[dict[str, str]] = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

ISO_FORMAT: Final[str] = "%Y-%m-%dT%H:%M:%SZ"

SERVER_NOW: Final = text("(strftime('%Y-%m-%dT%H:%M:%SZ','now'))")


def utcnow() -> datetime:
    """Timezone-aware UTC now; the default clock used by the service layer."""
    return datetime.now(UTC)


def new_uuid() -> str:
    """UUID4 hex string, the internal primary-key format."""
    return uuid.uuid4().hex


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def utc_to_storage(value: datetime) -> str:
    """Render a datetime as the ``YYYY-MM-DDTHH:MM:SSZ`` storage form."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).strftime(ISO_FORMAT)


class UTCTimestamp(TypeDecorator[datetime]):
    """TEXT ISO-8601 ``Z`` column surfaced as timezone-aware datetime.

    SQLite has no native datetime type; docs/DATABASE.md §1 mandates the
    ``YYYY-MM-DDTHH:MM:SSZ`` text form so values sort and compare correctly
    as plain strings. Naive datetimes are assumed UTC.
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: object) -> str | None:
        if value is None:
            return None
        return utc_to_storage(value)

    def process_result_value(self, value: str | None, dialect: object) -> datetime | None:
        if value is None:
            return None
        return datetime.strptime(value, ISO_FORMAT).replace(tzinfo=UTC)


class UUIDKeyMixin:
    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_uuid)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        UTCTimestamp, nullable=False, server_default=SERVER_NOW
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCTimestamp, nullable=False, server_default=SERVER_NOW
    )
