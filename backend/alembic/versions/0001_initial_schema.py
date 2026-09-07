"""initial schema: users, sessions, zones, records, tags, changes

Implements docs/DATABASE.md §14 verbatim with named constraints, explicit
CHECK constraints, and the partial unique index that closes the NULL
set_identifier hole in the natural key (§5). Written by hand against the
model metadata; tests assert the migrated DDL is byte-identical to
``Base.metadata.create_all`` output.
"""

from __future__ import annotations

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

NOW = "(strftime('%Y-%m-%dT%H:%M:%SZ','now'))"


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("username", sa.String(length=64), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("aws_account_id", sa.String(length=16), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=True),
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.Text(), server_default=sa.text(NOW), nullable=False),
        sa.Column("updated_at", sa.Text(), server_default=sa.text(NOW), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.CheckConstraint(
            "length(aws_account_id) = 12 AND aws_account_id NOT GLOB '*[^0-9]*'",
            name="ck_users_aws_account_id_format",
        ),
        sa.UniqueConstraint("username", name="uq_users_username"),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_table(
        "sessions",
        sa.Column("user_id", sa.String(length=32), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.Text(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("last_seen_at", sa.Text(), nullable=False),
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_sessions"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="fk_sessions_user_id_users",
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_sessions_token", "sessions", ["token"], unique=True)
    op.create_table(
        "hosted_zones",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("vpc_id", sa.String(length=32), nullable=True),
        sa.Column("vpc_region", sa.String(length=32), nullable=True),
        sa.Column("caller_reference", sa.String(length=64), nullable=False),
        sa.Column("record_set_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("owner_user_id", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.Text(), server_default=sa.text(NOW), nullable=False),
        sa.Column("updated_at", sa.Text(), server_default=sa.text(NOW), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_hosted_zones"),
        sa.CheckConstraint("id GLOB 'Z[A-Z0-9]*'", name="ck_hosted_zones_id_format"),
        sa.CheckConstraint(
            "comment IS NULL OR length(comment) <= 256",
            name="ck_hosted_zones_comment_length",
        ),
        sa.CheckConstraint("type IN ('public','private')", name="ck_hosted_zones_type_values"),
        sa.CheckConstraint(
            "record_set_count >= 0", name="ck_hosted_zones_record_set_count_non_negative"
        ),
        sa.UniqueConstraint("caller_reference", name="uq_hosted_zones_caller_reference"),
        sa.UniqueConstraint(
            "owner_user_id", "name", "type", name="uq_hosted_zones_owner_name_type"
        ),
        sa.ForeignKeyConstraint(
            ["owner_user_id"],
            ["users.id"],
            name="fk_hosted_zones_owner_user_id_users",
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_zones_owner_name", "hosted_zones", ["owner_user_id", "name"])
    op.create_table(
        "resource_record_sets",
        sa.Column("hosted_zone_id", sa.String(length=32), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("ttl", sa.Integer(), nullable=True),
        sa.Column(
            "routing_policy",
            sa.String(length=32),
            server_default=sa.text("'simple'"),
            nullable=False,
        ),
        sa.Column("set_identifier", sa.String(length=128), nullable=True),
        sa.Column("weight", sa.Integer(), nullable=True),
        sa.Column("region", sa.String(length=32), nullable=True),
        sa.Column("failover", sa.String(length=16), nullable=True),
        sa.Column("geo_continent", sa.String(length=8), nullable=True),
        sa.Column("geo_country", sa.String(length=8), nullable=True),
        sa.Column("geo_subdivision", sa.String(length=16), nullable=True),
        sa.Column("is_alias", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("alias_target", sa.Text(), nullable=True),
        sa.Column("alias_hosted_zone_id", sa.String(length=32), nullable=True),
        sa.Column("alias_evaluate_target_health", sa.Integer(), nullable=True),
        sa.Column("health_check_id", sa.String(length=64), nullable=True),
        sa.Column("is_system", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.Text(), server_default=sa.text(NOW), nullable=False),
        sa.Column("updated_at", sa.Text(), server_default=sa.text(NOW), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_resource_record_sets"),
        sa.CheckConstraint(
            "type IN ('A','AAAA','CNAME','TXT','MX','NS','PTR','SRV','CAA','SOA',"
            "'NAPTR','SPF','DS')",
            name="ck_resource_record_sets_type_values",
        ),
        sa.CheckConstraint(
            "ttl IS NULL OR (ttl >= 1 AND ttl <= 2147483647)",
            name="ck_resource_record_sets_ttl_range",
        ),
        sa.CheckConstraint(
            "routing_policy IN ('simple','weighted','latency','failover',"
            "'geolocation','multivalue')",
            name="ck_resource_record_sets_routing_policy_values",
        ),
        sa.CheckConstraint(
            "weight IS NULL OR (weight >= 0 AND weight <= 255)",
            name="ck_resource_record_sets_weight_range",
        ),
        sa.CheckConstraint(
            "failover IS NULL OR failover IN ('PRIMARY','SECONDARY')",
            name="ck_resource_record_sets_failover_values",
        ),
        sa.CheckConstraint("is_alias IN (0,1)", name="ck_resource_record_sets_is_alias_values"),
        sa.CheckConstraint(
            "alias_evaluate_target_health IS NULL OR alias_evaluate_target_health IN (0,1)",
            name="ck_resource_record_sets_alias_evaluate_target_health_values",
        ),
        sa.CheckConstraint("is_system IN (0,1)", name="ck_resource_record_sets_is_system_values"),
        sa.UniqueConstraint(
            "hosted_zone_id",
            "name",
            "type",
            "set_identifier",
            name="uq_resource_record_sets_natural_key",
        ),
        sa.ForeignKeyConstraint(
            ["hosted_zone_id"],
            ["hosted_zones.id"],
            name="fk_resource_record_sets_hosted_zone_id_hosted_zones",
            ondelete="CASCADE",
        ),
    )
    op.create_index(
        "ix_records_zone_name_type",
        "resource_record_sets",
        ["hosted_zone_id", "name", "type"],
    )
    op.create_index(
        "uq_records_zone_name_type_sid_null",
        "resource_record_sets",
        ["hosted_zone_id", "name", "type"],
        unique=True,
        sqlite_where=sa.text("set_identifier IS NULL"),
    )
    op.create_table(
        "resource_record_values",
        sa.Column("record_set_id", sa.String(length=32), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_resource_record_values"),
        sa.CheckConstraint("length(value) >= 1", name="ck_resource_record_values_value_non_empty"),
        sa.CheckConstraint(
            "sort_order >= 0", name="ck_resource_record_values_sort_order_non_negative"
        ),
        sa.ForeignKeyConstraint(
            ["record_set_id"],
            ["resource_record_sets.id"],
            name="fk_resource_record_values_record_set_id_resource_record_sets",
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_values_record", "resource_record_values", ["record_set_id"])
    op.create_table(
        "tags",
        sa.Column("resource_type", sa.String(length=32), nullable=False),
        sa.Column("resource_id", sa.String(length=32), nullable=False),
        sa.Column("key", sa.String(length=128), nullable=False),
        sa.Column("value", sa.Text(), nullable=False),
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_tags"),
        sa.CheckConstraint(
            "resource_type IN ('hostedzone','healthcheck')",
            name="ck_tags_resource_type_values",
        ),
        sa.CheckConstraint("length(key) BETWEEN 1 AND 128", name="ck_tags_key_length"),
        sa.CheckConstraint("length(value) <= 256", name="ck_tags_value_length"),
        sa.UniqueConstraint("resource_type", "resource_id", "key", name="uq_tags_resource_key"),
    )
    op.create_index("ix_tags_resource", "tags", ["resource_type", "resource_id"])
    op.create_table(
        "change_batches",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("hosted_zone_id", sa.String(length=32), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            server_default=sa.text("'PENDING'"),
            nullable=False,
        ),
        sa.Column("submitted_at", sa.Text(), server_default=sa.text(NOW), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_change_batches"),
        sa.CheckConstraint("id GLOB 'C[A-Z0-9]*'", name="ck_change_batches_id_format"),
        sa.CheckConstraint(
            "status IN ('PENDING','INSYNC')", name="ck_change_batches_status_values"
        ),
        sa.ForeignKeyConstraint(
            ["hosted_zone_id"],
            ["hosted_zones.id"],
            name="fk_change_batches_hosted_zone_id_hosted_zones",
            ondelete="CASCADE",
        ),
    )
    op.create_index("ix_batches_zone_time", "change_batches", ["hosted_zone_id", "submitted_at"])
    op.create_table(
        "change_batch_items",
        sa.Column("change_batch_id", sa.String(length=32), nullable=False),
        sa.Column("action", sa.String(length=16), nullable=False),
        sa.Column("record_snapshot", sa.Text(), nullable=True),
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_change_batch_items"),
        sa.CheckConstraint(
            "action IN ('CREATE','DELETE','UPSERT')",
            name="ck_change_batch_items_action_values",
        ),
        sa.ForeignKeyConstraint(
            ["change_batch_id"],
            ["change_batches.id"],
            name="fk_change_batch_items_change_batch_id_change_batches",
            ondelete="CASCADE",
        ),
    )


def downgrade() -> None:
    op.drop_table("change_batch_items")
    op.drop_index("ix_batches_zone_time", table_name="change_batches")
    op.drop_table("change_batches")
    op.drop_index("ix_tags_resource", table_name="tags")
    op.drop_table("tags")
    op.drop_index("ix_values_record", table_name="resource_record_values")
    op.drop_table("resource_record_values")
    op.drop_index("uq_records_zone_name_type_sid_null", table_name="resource_record_sets")
    op.drop_index("ix_records_zone_name_type", table_name="resource_record_sets")
    op.drop_table("resource_record_sets")
    op.drop_index("ix_zones_owner_name", table_name="hosted_zones")
    op.drop_table("hosted_zones")
    op.drop_index("ix_sessions_token", table_name="sessions")
    op.drop_table("sessions")
    op.drop_table("users")
