"""Record service paths not covered by the R1-R11 rule tests: alias
creation, UPSERT (single and via batch), system-record PUT semantics, and
batch edge cases (missing/invalid items, item-count bounds).
"""

from __future__ import annotations

import pytest

from app.core.errors import Route53Error
from app.services.record import RecordSetPayload


async def test_alias_record_creates_successfully(record_service, user, zone, db):
    record, change = await record_service.create(
        db,
        user,
        zone.id,
        RecordSetPayload(
            name="alias",
            type="A",
            is_alias=True,
            alias_target="target.example.net",
            alias_hosted_zone_id="Z1234567890ABC",
            alias_evaluate_target_health=True,
        ),
    )
    assert record.ttl is None
    assert record.is_alias == 1
    assert record.alias_target == "target.example.net."
    assert record.alias_hosted_zone_id == "Z1234567890ABC"
    assert change.status == "PENDING"


async def test_duplicate_simple_record_rejected(record_service, user, zone, db):
    await record_service.create(
        db, user, zone.id, RecordSetPayload(name="simple", type="A", ttl=300, values=["192.0.2.1"])
    )
    with pytest.raises(Route53Error) as excinfo:
        await record_service.create(
            db,
            user,
            zone.id,
            RecordSetPayload(name="simple", type="A", ttl=300, values=["192.0.2.2"]),
        )
    assert excinfo.value.aws_code == "InvalidChangeBatch"
    assert excinfo.value.message == (
        "A record set with name simple.example.com., type A already exists."
    )


async def test_upsert_creates_when_absent(record_service, user, zone, db):
    change = await record_service.batch(
        db,
        user,
        zone.id,
        [("UPSERT", RecordSetPayload(name="ups", type="A", ttl=300, values=["192.0.2.1"]))],
    )
    assert change.status == "PENDING"
    rows, _ = await record_service.list(db, user, zone.id, search="ups")
    assert [r.name for r in rows] == ["ups.example.com."]


async def test_upsert_replaces_when_present(record_service, user, zone, db):
    created, _ = await record_service.create(
        db, user, zone.id, RecordSetPayload(name="ups2", type="A", ttl=300, values=["192.0.2.1"])
    )
    await record_service.batch(
        db,
        user,
        zone.id,
        [("UPSERT", RecordSetPayload(name="ups2", type="A", ttl=900, values=["192.0.2.9"]))],
    )
    rows, _ = await record_service.list(db, user, zone.id, search="ups2")
    assert len(rows) == 1
    assert rows[0].id == created.id
    assert rows[0].ttl == 900


async def test_batch_delete_missing_record_raises_no_such_record(record_service, user, zone, db):
    with pytest.raises(Route53Error) as excinfo:
        await record_service.batch(db, user, zone.id, [("DELETE", "not-a-real-id")])
    assert excinfo.value.aws_code == "NoSuchRecord"


async def test_batch_invalid_action_rejected(record_service, user, zone, db):
    with pytest.raises(Route53Error) as excinfo:
        await record_service.batch(
            db,
            user,
            zone.id,
            [("BOGUS", RecordSetPayload(name="x", type="A", ttl=300, values=["192.0.2.1"]))],  # type: ignore[list-item]
        )
    assert excinfo.value.aws_code == "InvalidChangeBatch"
    assert excinfo.value.message == "Invalid action BOGUS."


async def test_batch_empty_list_rejected(record_service, user, zone, db):
    with pytest.raises(Route53Error) as excinfo:
        await record_service.batch(db, user, zone.id, [])
    assert excinfo.value.message == "Changes must contain at least one item."


async def test_batch_over_max_items_rejected(record_service, user, zone, db):
    items = [
        ("CREATE", RecordSetPayload(name=f"host{i}", type="A", ttl=300, values=["192.0.2.1"]))
        for i in range(101)
    ]
    with pytest.raises(Route53Error) as excinfo:
        await record_service.batch(db, user, zone.id, items)
    assert excinfo.value.message == "Changes must contain at most 100 items."


async def test_system_record_ttl_and_values_are_editable(record_service, user, zone, db):
    rows, _ = await record_service.list(db, user, zone.id, record_type="NS", page_size=1)
    ns = rows[0]
    updated, change = await record_service.update(
        db,
        user,
        zone.id,
        ns.id,
        RecordSetPayload(
            name=ns.name,
            type="NS",
            ttl=3600,
            values=["ns-a.example.com.", "ns-b.example.com."],
        ),
    )
    assert updated.ttl == 3600
    assert change.status == "PENDING"
    values = await record_service.get_values_for(db, [updated.id])
    assert values[updated.id] == ["ns-a.example.com.", "ns-b.example.com."]


async def test_system_record_cannot_change_type(record_service, user, zone, db):
    rows, _ = await record_service.list(db, user, zone.id, record_type="NS", page_size=1)
    ns = rows[0]
    with pytest.raises(Route53Error) as excinfo:
        await record_service.update(
            db,
            user,
            zone.id,
            ns.id,
            RecordSetPayload(name=ns.name, type="A", ttl=300, values=["192.0.2.1"]),
        )
    assert excinfo.value.message == "System record sets cannot change type."


async def test_system_record_cannot_become_alias(record_service, user, zone, db):
    rows, _ = await record_service.list(db, user, zone.id, record_type="NS", page_size=1)
    ns = rows[0]
    with pytest.raises(Route53Error) as excinfo:
        await record_service.update(
            db,
            user,
            zone.id,
            ns.id,
            RecordSetPayload(name=ns.name, type="NS", is_alias=True, alias_target="x.example.com."),
        )
    assert excinfo.value.message == "System record sets cannot be alias records."
