"""tags table — key/value labels on zones and health checks (docs/DATABASE.md §7)."""

from __future__ import annotations

from typing import Final

from sqlalchemy import CheckConstraint, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDKeyMixin

TAG_RESOURCE_TYPES: Final = ("hostedzone", "healthcheck")

TAG_KEY_MAX: Final = 128
TAG_VALUE_MAX: Final = 256
TAGS_MAX_PER_RESOURCE: Final = 50


class Tag(UUIDKeyMixin, Base):
    __tablename__ = "tags"
    __table_args__ = (
        CheckConstraint(
            "resource_type IN ('hostedzone','healthcheck')", name="ck_tags_resource_type_values"
        ),
        CheckConstraint("length(key) BETWEEN 1 AND 128", name="ck_tags_key_length"),
        CheckConstraint("length(value) <= 256", name="ck_tags_value_length"),
        UniqueConstraint("resource_type", "resource_id", "key", name="uq_tags_resource_key"),
        Index("ix_tags_resource", "resource_type", "resource_id"),
    )

    resource_type: Mapped[str] = mapped_column(String(32))
    resource_id: Mapped[str] = mapped_column(String(32))
    key: Mapped[str] = mapped_column(String(TAG_KEY_MAX))
    value: Mapped[str] = mapped_column(Text)
