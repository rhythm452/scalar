"""Seed idempotency (docs/DATABASE.md §13): running the seed twice must
write identical rows once, not duplicate or error the second time.
"""

from __future__ import annotations

from sqlalchemy import func, select

from app.models import ChangeBatch, HostedZone, ResourceRecordSet, User
from app.seed.seed import run_seed


async def _counts(db):
    zones = (await db.execute(select(func.count()).select_from(HostedZone))).scalar_one()
    records = (await db.execute(select(func.count()).select_from(ResourceRecordSet))).scalar_one()
    changes = (await db.execute(select(func.count()).select_from(ChangeBatch))).scalar_one()
    return int(zones), int(records), int(changes)


async def _ids(db):
    zone_ids = set((await db.execute(select(HostedZone.id))).scalars().all())
    record_ids = set((await db.execute(select(ResourceRecordSet.id))).scalars().all())
    admin_id = (await db.execute(select(User.id).where(User.username == "admin"))).scalar_one()
    return zone_ids, record_ids, admin_id


async def test_seed_second_run_is_a_no_op(db) -> None:
    wrote_first = await run_seed(db)
    assert wrote_first is True

    counts_first = await _counts(db)
    ids_first = await _ids(db)
    assert counts_first == (14, 92, 2)

    wrote_second = await run_seed(db)
    assert wrote_second is False

    assert await _counts(db) == counts_first
    assert await _ids(db) == ids_first


async def test_seed_creates_the_documented_admin_user(db) -> None:
    await run_seed(db)
    admin = (await db.execute(select(User).where(User.username == "admin"))).scalar_one()
    assert admin.email == "admin@example.com"
    assert admin.aws_account_id == "123456789012"
