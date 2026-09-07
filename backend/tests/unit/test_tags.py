"""Tag service (docs/API.md §3): full-replace semantics, key/value length
bounds, the 50-tag cap, and duplicate-key rejection -- none of this is
exercised by the R1-R11 rule tests, which only touch zones and records.
"""

from __future__ import annotations

import pytest

from app.core.errors import Route53Error


async def test_replace_sets_tags(tag_service, user, zone, db):
    tags = await tag_service.replace_for_zone(
        db, user, zone.id, [{"key": "env", "value": "prod"}, {"key": "team", "value": "core"}]
    )
    assert {(t.key, t.value) for t in tags} == {("env", "prod"), ("team", "core")}

    fetched = await tag_service.list_for_zone(db, user, zone.id)
    assert {(t.key, t.value) for t in fetched} == {("env", "prod"), ("team", "core")}


async def test_replace_is_a_full_replace_not_a_merge(tag_service, user, zone, db):
    await tag_service.replace_for_zone(db, user, zone.id, [{"key": "old", "value": "1"}])
    await tag_service.replace_for_zone(db, user, zone.id, [{"key": "new", "value": "2"}])
    fetched = await tag_service.list_for_zone(db, user, zone.id)
    assert [(t.key, t.value) for t in fetched] == [("new", "2")]


async def test_empty_list_clears_all_tags(tag_service, user, zone, db):
    await tag_service.replace_for_zone(db, user, zone.id, [{"key": "a", "value": "1"}])
    await tag_service.replace_for_zone(db, user, zone.id, [])
    assert await tag_service.list_for_zone(db, user, zone.id) == []


async def test_more_than_50_tags_rejected(tag_service, user, zone, db):
    tags = [{"key": f"k{i}", "value": "v"} for i in range(51)]
    with pytest.raises(Route53Error) as excinfo:
        await tag_service.replace_for_zone(db, user, zone.id, tags)
    assert excinfo.value.aws_code == "InvalidInput"
    assert excinfo.value.message == "A resource may have at most 50 tags."


async def test_tag_key_too_long_rejected(tag_service, user, zone, db):
    with pytest.raises(Route53Error) as excinfo:
        await tag_service.replace_for_zone(db, user, zone.id, [{"key": "x" * 129, "value": "v"}])
    assert excinfo.value.aws_code == "InvalidInput"
    assert excinfo.value.message == "Tag keys must be 1-128 characters."


async def test_tag_key_empty_rejected(tag_service, user, zone, db):
    with pytest.raises(Route53Error) as excinfo:
        await tag_service.replace_for_zone(db, user, zone.id, [{"key": "", "value": "v"}])
    assert excinfo.value.message == "Tag keys must be 1-128 characters."


async def test_tag_value_too_long_rejected(tag_service, user, zone, db):
    with pytest.raises(Route53Error) as excinfo:
        await tag_service.replace_for_zone(db, user, zone.id, [{"key": "k", "value": "v" * 257}])
    assert excinfo.value.aws_code == "InvalidInput"
    assert excinfo.value.message == "Tag values must be 256 characters or fewer."


async def test_duplicate_tag_key_rejected(tag_service, user, zone, db):
    with pytest.raises(Route53Error) as excinfo:
        await tag_service.replace_for_zone(
            db, user, zone.id, [{"key": "env", "value": "a"}, {"key": "env", "value": "b"}]
        )
    assert excinfo.value.aws_code == "InvalidInput"
    assert excinfo.value.message == "Duplicate tag key env."


async def test_tags_for_unknown_zone_raise_no_such_hosted_zone(tag_service, user, db):
    with pytest.raises(Route53Error) as excinfo:
        await tag_service.list_for_zone(db, user, "ZDOESNOTEXIST00000")
    assert excinfo.value.aws_code == "NoSuchHostedZone"
