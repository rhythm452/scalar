"""resource_record_sets + resource_record_values (docs/DATABASE.md §5-6)."""

from __future__ import annotations

from typing import Final

from sqlalchemy import (
    CheckConstraint,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDKeyMixin

RECORD_TYPES: Final = (
    "A",
    "AAAA",
    "CNAME",
    "TXT",
    "MX",
    "NS",
    "PTR",
    "SRV",
    "CAA",
    "SOA",
    "NAPTR",
    "SPF",
    "DS",
)

ROUTING_POLICIES: Final = (
    "simple",
    "weighted",
    "latency",
    "failover",
    "geolocation",
    "multivalue",
)

TTL_MIN: Final = 1
TTL_MAX: Final = 2147483647


class ResourceRecordSet(UUIDKeyMixin, TimestampMixin, Base):
    __tablename__ = "resource_record_sets"
    __table_args__ = (
        CheckConstraint(
            "type IN ('A','AAAA','CNAME','TXT','MX','NS','PTR','SRV','CAA','SOA',"
            "'NAPTR','SPF','DS')",
            name="ck_resource_record_sets_type_values",
        ),
        CheckConstraint(
            "ttl IS NULL OR (ttl >= 1 AND ttl <= 2147483647)",
            name="ck_resource_record_sets_ttl_range",
        ),
        CheckConstraint(
            "routing_policy IN ('simple','weighted','latency','failover',"
            "'geolocation','multivalue')",
            name="ck_resource_record_sets_routing_policy_values",
        ),
        CheckConstraint(
            "weight IS NULL OR (weight >= 0 AND weight <= 255)",
            name="ck_resource_record_sets_weight_range",
        ),
        CheckConstraint(
            "failover IS NULL OR failover IN ('PRIMARY','SECONDARY')",
            name="ck_resource_record_sets_failover_values",
        ),
        CheckConstraint("is_alias IN (0,1)", name="ck_resource_record_sets_is_alias_values"),
        CheckConstraint(
            "alias_evaluate_target_health IS NULL OR alias_evaluate_target_health IN (0,1)",
            name="ck_resource_record_sets_alias_evaluate_target_health_values",
        ),
        CheckConstraint("is_system IN (0,1)", name="ck_resource_record_sets_is_system_values"),
        UniqueConstraint(
            "hosted_zone_id",
            "name",
            "type",
            "set_identifier",
            name="uq_resource_record_sets_natural_key",
        ),
        # SQLite UNIQUE treats NULL set_identifiers as distinct; this partial
        # index closes that hole so (zone, name, type) is unique for simple
        # records too (docs/DATABASE.md §5, ADR-007).
        Index(
            "uq_records_zone_name_type_sid_null",
            "hosted_zone_id",
            "name",
            "type",
            unique=True,
            sqlite_where=text("set_identifier IS NULL"),
        ),
        ForeignKeyConstraint(
            ["hosted_zone_id"],
            ["hosted_zones.id"],
            ondelete="CASCADE",
            name="fk_resource_record_sets_hosted_zone_id_hosted_zones",
        ),
        Index("ix_records_zone_name_type", "hosted_zone_id", "name", "type"),
    )

    hosted_zone_id: Mapped[str] = mapped_column(String(32))
    name: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(16))
    ttl: Mapped[int | None] = mapped_column(Integer)
    routing_policy: Mapped[str] = mapped_column(
        String(32), server_default=text("'simple'"), default="simple"
    )
    set_identifier: Mapped[str | None] = mapped_column(String(128))
    weight: Mapped[int | None] = mapped_column(Integer)
    region: Mapped[str | None] = mapped_column(String(32))
    failover: Mapped[str | None] = mapped_column(String(16))
    geo_continent: Mapped[str | None] = mapped_column(String(8))
    geo_country: Mapped[str | None] = mapped_column(String(8))
    geo_subdivision: Mapped[str | None] = mapped_column(String(16))
    is_alias: Mapped[int] = mapped_column(Integer, server_default=text("0"), default=0)
    alias_target: Mapped[str | None] = mapped_column(Text)
    alias_hosted_zone_id: Mapped[str | None] = mapped_column(String(32))
    alias_evaluate_target_health: Mapped[int | None] = mapped_column(Integer)
    health_check_id: Mapped[str | None] = mapped_column(String(64))
    is_system: Mapped[int] = mapped_column(Integer, server_default=text("0"), default=0)


class ResourceRecordValue(UUIDKeyMixin, Base):
    __tablename__ = "resource_record_values"
    __table_args__ = (
        CheckConstraint("length(value) >= 1", name="ck_resource_record_values_value_non_empty"),
        CheckConstraint(
            "sort_order >= 0", name="ck_resource_record_values_sort_order_non_negative"
        ),
        ForeignKeyConstraint(
            ["record_set_id"],
            ["resource_record_sets.id"],
            ondelete="CASCADE",
            name="fk_resource_record_values_record_set_id_resource_record_sets",
        ),
        Index("ix_values_record", "record_set_id"),
    )

    record_set_id: Mapped[str] = mapped_column(String(32))
    value: Mapped[str] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, server_default=text("0"), default=0)
