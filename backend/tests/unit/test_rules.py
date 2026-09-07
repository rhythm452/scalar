"""One test per domain rule R1-R11 (docs/ROUTE53-DOMAIN-RULES.md), plus
batch atomicity and record_set_count bookkeeping. Every assertion checks
the exact AWS error code and verbatim message, not just the status code.
"""

from __future__ import annotations

from datetime import timedelta

import pytest

from app.core.errors import Route53Error
from app.repositories import record_repository
from app.services.change import ChangeService
from app.services.hosted_zone import HostedZoneService
from app.services.record import RecordService, RecordSetPayload

# --------------------------------------------------------------------- R1


async def test_r1_auto_creates_apex_ns_and_soa(zone_service, record_service, user, db):
    z = await zone_service.create(db, user, name="r1.example.com", zone_type="public")
    assert z.record_set_count == 2

    rows, _ = await record_service.list(db, user, z.id, page_size=10)
    by_type = {r.type: r for r in rows}
    assert set(by_type) == {"NS", "SOA"}

    ns = by_type["NS"]
    assert ns.ttl == 172800
    assert ns.is_system == 1
    ns_values = await record_repository.get_values_for(db, [ns.id])
    assert ns_values[ns.id] == [
        "ns-2048.awsdns-64.com.",
        "ns-2049.awsdns-65.net.",
        "ns-2050.awsdns-66.org.",
        "ns-2051.awsdns-67.co.uk.",
    ]

    soa = by_type["SOA"]
    assert soa.ttl == 900
    assert soa.is_system == 1
    soa_values = await record_repository.get_values_for(db, [soa.id])
    assert soa_values[soa.id] == [
        "ns-2048.awsdns-64.com. awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"
    ]


# --------------------------------------------------------------------- R2


async def test_r2_cannot_delete_system_ns(record_service, user, zone, db):
    rows, _ = await record_service.list(db, user, zone.id, record_type="NS", page_size=1)
    with pytest.raises(Route53Error) as excinfo:
        await record_service.delete(db, user, zone.id, rows[0].id)
    assert excinfo.value.aws_code == "InvalidChangeBatch"
    assert excinfo.value.http_status == 400
    assert excinfo.value.message == "System record of type NS at the zone apex cannot be deleted."


async def test_r2_cannot_delete_system_soa(record_service, user, zone, db):
    rows, _ = await record_service.list(db, user, zone.id, record_type="SOA", page_size=1)
    with pytest.raises(Route53Error) as excinfo:
        await record_service.delete(db, user, zone.id, rows[0].id)
    assert excinfo.value.aws_code == "InvalidChangeBatch"
    assert excinfo.value.message == "System record of type SOA cannot be deleted."


# --------------------------------------------------------------------- R3


async def test_r3_zone_delete_blocked_while_not_empty(zone_service, record_service, user, zone, db):
    await record_service.create(
        db, user, zone.id, RecordSetPayload(name="www", type="A", ttl=300, values=["192.0.2.1"])
    )
    with pytest.raises(Route53Error) as excinfo:
        await zone_service.delete(db, user, zone.id)
    assert excinfo.value.aws_code == "HostedZoneNotEmpty"
    assert excinfo.value.http_status == 400
    assert excinfo.value.message == (
        "Hosted Zone is not empty. Delete all non-default record sets before "
        "deleting the hosted zone."
    )


async def test_r3_zone_delete_succeeds_when_only_system_records_remain(
    zone_service, user, zone, db
):
    await zone_service.delete(db, user, zone.id)
    with pytest.raises(Route53Error) as excinfo:
        await zone_service.get(db, user, zone.id)
    assert excinfo.value.aws_code == "NoSuchHostedZone"


# --------------------------------------------------------------------- R4


async def test_r4_cname_blocks_other_type_at_same_name(record_service, user, zone, db):
    await record_service.create(
        db,
        user,
        zone.id,
        RecordSetPayload(name="dup", type="CNAME", ttl=300, values=["target.example.com"]),
    )
    with pytest.raises(Route53Error) as excinfo:
        await record_service.create(
            db, user, zone.id, RecordSetPayload(name="dup", type="A", ttl=300, values=["192.0.2.1"])
        )
    assert excinfo.value.aws_code == "InvalidChangeBatch"
    assert excinfo.value.message == (
        "RRSet of type A with DNS name dup.example.com. is not permitted "
        "because a conflicting RRSet exists."
    )


async def test_r4_other_type_blocks_cname_at_same_name(record_service, user, zone, db):
    await record_service.create(
        db, user, zone.id, RecordSetPayload(name="dup2", type="A", ttl=300, values=["192.0.2.1"])
    )
    with pytest.raises(Route53Error) as excinfo:
        await record_service.create(
            db,
            user,
            zone.id,
            RecordSetPayload(name="dup2", type="CNAME", ttl=300, values=["target.example.com"]),
        )
    assert excinfo.value.aws_code == "InvalidChangeBatch"
    assert excinfo.value.message == (
        "RRSet of type CNAME with DNS name dup2.example.com. is not permitted "
        "because a conflicting RRSet exists."
    )


# --------------------------------------------------------------------- R5


async def test_r5_name_outside_zone_rejected(record_service, user, zone, db):
    with pytest.raises(Route53Error) as excinfo:
        await record_service.create(
            db,
            user,
            zone.id,
            RecordSetPayload(name="www.other.com.", type="A", ttl=300, values=["192.0.2.1"]),
        )
    assert excinfo.value.aws_code == "InvalidChangeBatch"
    assert excinfo.value.message == (
        "RRSet with DNS name www.other.com. is not permitted in zone example.com.."
    )


async def test_r5_bare_apex_and_relative_names_normalise_into_zone(record_service, user, zone, db):
    apex, _ = await record_service.create(
        db, user, zone.id, RecordSetPayload(name="@", type="TXT", ttl=300, values=['"apex"'])
    )
    assert apex.name == "example.com."

    relative, _ = await record_service.create(
        db, user, zone.id, RecordSetPayload(name="www", type="A", ttl=300, values=["192.0.2.1"])
    )
    assert relative.name == "www.example.com."


# --------------------------------------------------------------------- R6


async def test_r6_ttl_required_for_non_alias(record_service, user, zone, db):
    with pytest.raises(Route53Error) as excinfo:
        await record_service.create(
            db,
            user,
            zone.id,
            RecordSetPayload(name="nottl", type="A", ttl=None, values=["192.0.2.1"]),
        )
    assert excinfo.value.aws_code == "InvalidChangeBatch"
    assert excinfo.value.message == "TTL is required for non-alias records."


async def test_r6_ttl_forbidden_on_alias(record_service, user, zone, db):
    with pytest.raises(Route53Error) as excinfo:
        await record_service.create(
            db,
            user,
            zone.id,
            RecordSetPayload(
                name="aliasttl",
                type="A",
                ttl=300,
                is_alias=True,
                alias_target="target.example.com.",
            ),
        )
    assert excinfo.value.aws_code == "InvalidChangeBatch"
    assert excinfo.value.message == "Alias records must not specify TTL."


async def test_r6_alias_target_required(record_service, user, zone, db):
    with pytest.raises(Route53Error) as excinfo:
        await record_service.create(
            db, user, zone.id, RecordSetPayload(name="aliasnotarget", type="A", is_alias=True)
        )
    assert excinfo.value.aws_code == "InvalidChangeBatch"
    assert excinfo.value.message == "AliasTarget is required for alias records."


# --------------------------------------------------------------------- R7


async def test_r7_soa_cannot_be_created_directly(record_service, user, zone, db):
    with pytest.raises(Route53Error) as excinfo:
        await record_service.create(
            db,
            user,
            zone.id,
            RecordSetPayload(name="@", type="SOA", ttl=900, values=["a b 1 2 3 4 5"]),
        )
    assert excinfo.value.aws_code == "InvalidChangeBatch"
    assert excinfo.value.message == (
        "SOA records are managed automatically and cannot be created directly."
    )


async def test_r7_invalid_value_rejected_through_the_service(record_service, user, zone, db):
    with pytest.raises(Route53Error) as excinfo:
        await record_service.create(
            db,
            user,
            zone.id,
            RecordSetPayload(name="badip", type="A", ttl=300, values=["not-an-ip"]),
        )
    assert excinfo.value.aws_code == "InvalidChangeBatch"
    assert excinfo.value.message == "Value not-an-ip is not a valid IPv4 address."


# --------------------------------------------------------------------- R8


async def test_r8_set_identifier_required_for_non_simple_routing(record_service, user, zone, db):
    with pytest.raises(Route53Error) as excinfo:
        await record_service.create(
            db,
            user,
            zone.id,
            RecordSetPayload(
                name="w",
                type="A",
                ttl=60,
                values=["192.0.2.1"],
                routing_policy="weighted",
                weight=10,
            ),
        )
    assert excinfo.value.aws_code == "InvalidChangeBatch"
    assert excinfo.value.message == "SetIdentifier is required for non-simple routing policies."


async def test_r8_duplicate_set_identifier_rejected(record_service, user, zone, db):
    await record_service.create(
        db,
        user,
        zone.id,
        RecordSetPayload(
            name="w2",
            type="A",
            ttl=60,
            values=["192.0.2.1"],
            routing_policy="weighted",
            weight=10,
            set_identifier="primary",
        ),
    )
    with pytest.raises(Route53Error) as excinfo:
        await record_service.create(
            db,
            user,
            zone.id,
            RecordSetPayload(
                name="w2",
                type="A",
                ttl=60,
                values=["192.0.2.2"],
                routing_policy="weighted",
                weight=20,
                set_identifier="primary",
            ),
        )
    assert excinfo.value.aws_code == "InvalidChangeBatch"
    assert excinfo.value.message == (
        "A record set with name w2.example.com., type A, and identifier primary already exists."
    )


# --------------------------------------------------------------------- R9


async def test_r9_duplicate_zone_name_rejected(zone_service, user, zone, db):
    with pytest.raises(Route53Error) as excinfo:
        await zone_service.create(db, user, name="example.com", zone_type="public")
    assert excinfo.value.aws_code == "HostedZoneAlreadyExists"
    assert excinfo.value.http_status == 409
    assert excinfo.value.message == (
        "A hosted zone with name example.com. and type public already exists for this account."
    )


# -------------------------------------------------------------------- R10


async def test_r10_comment_over_256_chars_rejected(zone_service, user, db):
    with pytest.raises(Route53Error) as excinfo:
        await zone_service.create(
            db, user, name="toolong.example.com", zone_type="public", comment="x" * 257
        )
    assert excinfo.value.aws_code == "InvalidInput"
    assert excinfo.value.http_status == 400
    assert excinfo.value.message == "Description must be 256 characters or fewer."


async def test_r10_comment_at_256_chars_accepted(zone_service, user, db):
    z = await zone_service.create(
        db, user, name="atmax.example.com", zone_type="public", comment="x" * 256
    )
    assert z.comment == "x" * 256


# -------------------------------------------------------------------- R11


async def test_r11_change_status_flips_pending_to_insync_after_60s(
    record_service: RecordService,
    change_service: ChangeService,
    user,
    zone,
    db,
    clock,
):
    _, change = await record_service.create(
        db, user, zone.id, RecordSetPayload(name="r11", type="A", ttl=300, values=["192.0.2.1"])
    )
    assert change.status == "PENDING"

    still_pending = await change_service.get(db, change.id)
    assert still_pending.status == "PENDING"

    clock.at(clock() + timedelta(seconds=60))
    now_insync = await change_service.get(db, change.id)
    assert now_insync.status == "INSYNC"


# ---------------------------------------------------------- batch atomicity


async def test_batch_partial_failure_writes_nothing(record_service, user, zone, db):
    # A service-level rollback expires every ORM object already loaded in
    # this session (including `zone`), so `zone_id` is captured up front
    # rather than re-reading `zone.id` after the failure below -- doing so
    # would trip AsyncSession's MissingGreenlet guard on the implicit
    # refresh of an expired attribute.
    zone_id = zone.id
    before, _ = await record_service.list(db, user, zone_id, page_size=100)
    items: list[tuple[str, RecordSetPayload]] = [
        ("CREATE", RecordSetPayload(name="okone", type="A", ttl=300, values=["192.0.2.1"])),
        ("CREATE", RecordSetPayload(name="badone", type="A", ttl=300, values=["not-an-ip"])),
    ]
    with pytest.raises(Route53Error):
        await record_service.batch(db, user, zone_id, list(items))
    await db.refresh(user)  # rollback expired every object in the session

    after, _ = await record_service.list(db, user, zone_id, page_size=100)
    assert len(after) == len(before)
    assert "okone.example.com." not in {r.name for r in after}


async def test_batch_all_succeed_commits_together(record_service, user, zone, db):
    items: list[tuple[str, RecordSetPayload]] = [
        ("CREATE", RecordSetPayload(name="batch1", type="A", ttl=300, values=["192.0.2.1"])),
        ("CREATE", RecordSetPayload(name="batch2", type="A", ttl=300, values=["192.0.2.2"])),
    ]
    change = await record_service.batch(db, user, zone.id, list(items))
    assert change.status == "PENDING"
    rows, _ = await record_service.list(db, user, zone.id, page_size=100)
    names = {r.name for r in rows}
    assert {"batch1.example.com.", "batch2.example.com."} <= names


# ------------------------------------------------------------ record_set_count


async def test_record_set_count_after_create_and_delete(
    record_service: RecordService, zone_service: HostedZoneService, user, zone, db
):
    assert zone.record_set_count == 2
    record, _ = await record_service.create(
        db, user, zone.id, RecordSetPayload(name="cnt", type="A", ttl=300, values=["192.0.2.1"])
    )
    after_create = await zone_service.get(db, user, zone.id)
    assert after_create.record_set_count == 3

    await record_service.delete(db, user, zone.id, record.id)
    after_delete = await zone_service.get(db, user, zone.id)
    assert after_delete.record_set_count == 2


async def test_record_set_count_unchanged_after_failed_mutation(
    record_service: RecordService, zone_service: HostedZoneService, user, zone, db
):
    zone_id = zone.id  # captured before the rollback below expires `zone`
    with pytest.raises(Route53Error):
        await record_service.create(
            db, user, zone_id, RecordSetPayload(name="bad", type="A", ttl=300, values=["not-an-ip"])
        )
    await db.refresh(user)  # rollback expired every object in the session
    unchanged = await zone_service.get(db, user, zone_id)
    assert unchanged.record_set_count == 2
