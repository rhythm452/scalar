"""Idempotent seed (docs/DATABASE.md §13).

Runs on backend boot when ``SEED_ON_BOOT=true`` and the ``users`` table is
empty. Everything is written in one transaction so a crash mid-seed leaves
the database untouched and the next boot retries. The demo user is
``admin`` / ``password123``.

The dataset is intentionally rich so the Phase 2 console has something to
show on every screen: 14 zones (two private with VPCs), a 60+ record demo
zone covering every record type, aliases, weighted/failover/latency/
multivalue routing, tags on several zones, and old change batches that
read back as INSYNC via R11.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import (
    ChangeBatch,
    ChangeBatchItem,
    HostedZone,
    ResourceRecordSet,
    ResourceRecordValue,
    Tag,
    User,
)
from app.models.base import new_uuid
from app.repositories import UserRepository
from app.services.hosted_zone import (
    R1_NS_TARGETS,
    R1_NS_TTL,
    R1_SOA_TTL,
    R1_SOA_VALUE,
)

SEED_ACCOUNT_ID = "123456789012"
DEMO_ZONE_INDEX = 1


def _zone_id(index: int) -> str:
    return f"ZSEED{index:013d}"


DEMO_ZONE_ID = _zone_id(DEMO_ZONE_INDEX)
DEMO_ZONE_NAME = "example.com."

ZONES: list[dict[str, str | None]] = [
    {"id": _zone_id(1), "name": "example.com.", "type": "public", "comment": "Seeded demo zone"},
    {"id": _zone_id(2), "name": "scalar.dev.", "type": "public", "comment": "Product site"},
    {"id": _zone_id(3), "name": "shop.example.com.", "type": "public", "comment": "Storefront"},
    {"id": _zone_id(4), "name": "cdn.example.net.", "type": "public", "comment": None},
    {"id": _zone_id(5), "name": "mail.example.org.", "type": "public", "comment": "Mail domain"},
    {"id": _zone_id(6), "name": "status.scalar.dev.", "type": "public", "comment": "Status page"},
    {"id": _zone_id(7), "name": "api.example.io.", "type": "public", "comment": None},
    {
        "id": _zone_id(8),
        "name": "blog.scalar.dev.",
        "type": "public",
        "comment": "Engineering blog",
    },
    {"id": _zone_id(9), "name": "metrics.example.net.", "type": "public", "comment": None},
    {"id": _zone_id(10), "name": "files.example.org.", "type": "public", "comment": None},
    {"id": _zone_id(11), "name": "staging.example.com.", "type": "public", "comment": "Staging"},
    {"id": _zone_id(12), "name": "legacy.scalar.dev.", "type": "public", "comment": "Legacy"},
    {
        "id": _zone_id(13),
        "name": "corp.internal.",
        "type": "private",
        "vpc_id": "vpc-0a1b2c3d4e",
        "vpc_region": "us-east-1",
        "comment": "Internal corporate",
    },
    {
        "id": _zone_id(14),
        "name": "vpn.internal.",
        "type": "private",
        "vpc_id": "vpc-0f5e6d7c8b",
        "vpc_region": "eu-west-1",
        "comment": "VPN endpoints",
    },
]

TAGS: dict[str, list[dict[str, str]]] = {
    _zone_id(1): [{"key": "env", "value": "prod"}, {"key": "team", "value": "core"}],
    _zone_id(2): [{"key": "env", "value": "dev"}],
    _zone_id(11): [{"key": "env", "value": "staging"}],
    _zone_id(13): [{"key": "env", "value": "internal"}, {"key": "cost-center", "value": "ops"}],
    _zone_id(14): [{"key": "env", "value": "internal"}, {"key": "cost-center", "value": "net"}],
}


def demo_records() -> list[tuple[ResourceRecordSet, list[str]]]:
    """The demo zone's record sets paired with their values: a curated
    cross-section of every type and routing policy, plus numbered hosts so
    list pagination, search, and type filters operate on real data."""
    z = DEMO_ZONE_ID
    records: list[tuple[ResourceRecordSet, list[str]]] = [
        (_record(z, "example.com.", "A", ttl=300), ["192.0.2.10"]),
        (_record(z, "www", "A", ttl=300), ["192.0.2.1", "192.0.2.2"]),
        (_record(z, "www", "AAAA", ttl=300), ["2001:db8::1"]),
        (_record(z, "api", "A", ttl=60), ["192.0.2.11", "192.0.2.12", "192.0.2.13"]),
        (
            _record(
                z,
                "api-eu",
                "A",
                ttl=60,
                routing_policy="latency",
                set_identifier="eu-west",
                region="eu-west-1",
            ),
            ["198.51.100.11"],
        ),
        (_record(z, "docs", "CNAME", ttl=300), ["docs.example.net."]),
        (_record(z, "mail", "A", ttl=3600), ["192.0.2.20"]),
        (_record(z, "mail", "MX", ttl=3600), ["10 mail.example.com.", "20 backup.example.org."]),
        (_record(z, "example.com.", "TXT", ttl=3600), ['"v=spf1 mx -all"']),
        (
            _record(z, "_dmarc", "TXT", ttl=3600),
            ['"v=DMARC1; p=none; rua=mailto:dmarc@example.com"'],
        ),
        (_record(z, "mail._domainkey", "TXT", ttl=3600), ['"v=DKIM1; k=rsa; p=MIIBIjANBgkq"']),
        (_record(z, "_sip._tcp", "SRV", ttl=300), ["10 60 5060 sip.example.com."]),
        (_record(z, "_xmpp._tcp", "SRV", ttl=300), ["5 0 5269 xmpp.example.com."]),
        (_record(z, "4.2.0.192.in-addr", "PTR", ttl=300), ["www.example.com."]),
        (
            _record(z, "example.com.", "CAA", ttl=3600),
            ['0 issue "letsencrypt.org"', '0 iodef "mailto:security@example.com"'],
        ),
        (_record(z, "example.com.", "SPF", ttl=3600), ['"v=spf1 mx -all"']),
        (
            _record(z, "_sip", "NAPTR", ttl=300),
            ['100 10 "S" "SIP+D2U" "!^.*$!sip:info@example.com!" _sip._tcp.example.com.'],
        ),
        (
            _record(z, "sub", "NS", ttl=172800),
            ["ns-2048.awsdns-64.com.", "ns-2049.awsdns-65.net."],
        ),
        (_record(z, "sub", "DS", ttl=3600), ["12345 13 2 deadbeef1234abcd5678901234abcd"]),
        (
            _record(
                z,
                "www-alias",
                "A",
                ttl=None,
                is_alias=1,
                alias_target="dualstack.lb.example.net.",
                alias_hosted_zone_id=_zone_id(4),
            ),
            [],
        ),
        (
            _record(
                z,
                "api-alias",
                "A",
                ttl=None,
                is_alias=1,
                alias_target="dualstack.api-lb.example.net.",
                alias_hosted_zone_id=_zone_id(4),
            ),
            [],
        ),
        (
            _record(
                z,
                "shop-alias",
                "A",
                ttl=None,
                is_alias=1,
                alias_target="shop.example.com.",
                alias_hosted_zone_id=DEMO_ZONE_ID,
            ),
            [],
        ),
        (
            _record(
                z, "geo", "A", ttl=60, routing_policy="weighted", set_identifier="north", weight=100
            ),
            ["192.0.2.30"],
        ),
        (
            _record(
                z, "geo", "A", ttl=60, routing_policy="weighted", set_identifier="south", weight=100
            ),
            ["192.0.2.31"],
        ),
        (
            _record(
                z,
                "db",
                "A",
                ttl=60,
                routing_policy="failover",
                set_identifier="primary",
                failover="PRIMARY",
            ),
            ["192.0.2.40"],
        ),
        (
            _record(
                z,
                "db",
                "A",
                ttl=60,
                routing_policy="failover",
                set_identifier="secondary",
                failover="SECONDARY",
            ),
            ["192.0.2.41"],
        ),
        (
            _record(z, "edge", "A", ttl=60, routing_policy="multivalue", set_identifier="edge-1"),
            ["203.0.113.10"],
        ),
        (
            _record(z, "edge", "A", ttl=60, routing_policy="multivalue", set_identifier="edge-2"),
            ["203.0.113.11"],
        ),
        (
            _record(z, "edge", "A", ttl=60, routing_policy="multivalue", set_identifier="edge-3"),
            ["203.0.113.12"],
        ),
    ]
    for i in range(1, 36):
        host = f"host{i:02d}"
        if i % 5 == 0:
            records.append((_record(z, host, "TXT", ttl=600), [f'"host {i} of the seeded fleet"']))
        elif i % 5 == 4:
            records.append((_record(z, host, "CNAME", ttl=600), ["www.example.com."]))
        else:
            records.append((_record(z, host, "A", ttl=600), [f"192.0.2.{100 + i}"]))
    return records


def _record(
    zone_id: str,
    name: str,
    record_type: str,
    *,
    ttl: int | None = 300,
    routing_policy: str = "simple",
    set_identifier: str | None = None,
    weight: int | None = None,
    region: str | None = None,
    failover: str | None = None,
    is_alias: int = 0,
    alias_target: str | None = None,
    alias_hosted_zone_id: str | None = None,
) -> ResourceRecordSet:
    return ResourceRecordSet(
        id=new_uuid(),
        hosted_zone_id=zone_id,
        name=f"{name}.{DEMO_ZONE_NAME}" if not name.endswith(".") else name,
        type=record_type,
        ttl=ttl,
        routing_policy=routing_policy,
        set_identifier=set_identifier,
        weight=weight,
        region=region,
        failover=failover,
        is_alias=is_alias,
        alias_target=alias_target,
        alias_hosted_zone_id=alias_hosted_zone_id,
        is_system=0,
    )


async def run_seed(db: AsyncSession) -> bool:
    """Seed the demo dataset when the users table is empty.

    Returns True when data was written. The whole dataset commits once, so
    a failure anywhere leaves the database empty and the next boot retries.
    """
    users = UserRepository()
    if await users.count(db) > 0:
        return False

    now = datetime.now(UTC)
    started = now - timedelta(days=14)
    demo = demo_records()
    demo_when = now - timedelta(days=7)

    admin = User(
        id="useed000000000000000000000001",
        username="admin",
        email="admin@example.com",
        password_hash=hash_password("password123"),
        aws_account_id=SEED_ACCOUNT_ID,
        display_name="Admin",
        created_at=started,
        updated_at=started,
    )
    db.add(admin)

    for index, spec in enumerate(ZONES):
        count = 2 + len(demo) if spec["id"] == DEMO_ZONE_ID else 2
        zone = HostedZone(
            id=str(spec["id"]),
            name=str(spec["name"]),
            comment=spec["comment"],
            type=str(spec["type"]),
            vpc_id=spec.get("vpc_id"),
            vpc_region=spec.get("vpc_region"),
            caller_reference=f"seed-{index}",
            record_set_count=count,
            owner_user_id=admin.id,
            created_at=started + timedelta(days=index),
            updated_at=started + timedelta(days=index),
        )
        db.add(zone)
        for record_type, ttl, values in (
            ("NS", R1_NS_TTL, list(R1_NS_TARGETS)),
            ("SOA", R1_SOA_TTL, [R1_SOA_VALUE]),
        ):
            system = ResourceRecordSet(
                id=new_uuid(),
                hosted_zone_id=zone.id,
                name=zone.name,
                type=record_type,
                ttl=ttl,
                routing_policy="simple",
                is_alias=0,
                is_system=1,
                created_at=zone.created_at,
                updated_at=zone.created_at,
            )
            db.add(system)
            for order, value in enumerate(values):
                db.add(ResourceRecordValue(record_set_id=system.id, value=value, sort_order=order))

    for record, values in demo:
        record.created_at = demo_when
        record.updated_at = demo_when
        db.add(record)
        for order, value in enumerate(values):
            db.add(ResourceRecordValue(record_set_id=record.id, value=value, sort_order=order))

    for zone_id, tag_pairs in TAGS.items():
        for pair in tag_pairs:
            db.add(
                Tag(
                    resource_type="hostedzone",
                    resource_id=zone_id,
                    key=pair["key"],
                    value=pair["value"],
                )
            )

    # Old change batches: status stays PENDING on disk but reads derive
    # INSYNC through R11 (docs/ROUTE53-DOMAIN-RULES.md R11).
    seeded_changes = [
        ("CSEED0000000001", "initial import", [("CREATE", demo[0][0]), ("CREATE", demo[1][0])]),
        ("CSEED0000000002", "routing update", [("UPSERT", demo[-1][0])]),
    ]
    for change_id, comment, items in seeded_changes:
        batch = ChangeBatch(
            id=change_id,
            hosted_zone_id=DEMO_ZONE_ID,
            status="PENDING",
            submitted_at=demo_when,
            comment=comment,
        )
        db.add(batch)
        for action, record in items:
            db.add(
                ChangeBatchItem(
                    change_batch_id=batch.id,
                    action=action,
                    record_snapshot=_record_snapshot(record),
                )
            )

    await db.commit()
    return True


def _record_snapshot(record: ResourceRecordSet) -> str:
    return json.dumps(
        {
            "id": record.id,
            "hosted_zone_id": record.hosted_zone_id,
            "name": record.name,
            "type": record.type,
            "ttl": record.ttl,
            "routing_policy": record.routing_policy,
            "set_identifier": record.set_identifier,
            "is_alias": record.is_alias,
            "alias_target": record.alias_target,
            "is_system": record.is_system,
        }
    )
