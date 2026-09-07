"""Pragma-under-pool-churn (docs/DATABASE.md §1.4, ADR-002): ``foreign_keys``
and ``journal_mode`` are applied via a SQLAlchemy ``"connect"`` event
listener attached to the pool (``app/db/session.py``), which fires for
*every* new DBAPI connection the pool opens, not just the first. That claim
was previously verified only by inspection.

Proven here under real concurrent pool churn against a file-backed engine
built the same way production is (``create_db_engine``) -- the in-memory
``StaticPool`` engine every other test in this suite uses only ever hands
out one physical connection, so it cannot exercise this path at all.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.session import create_db_engine
from app.models import Tag
from tests.conftest import run_migrations_on

CONCURRENT_CONNECTIONS = 20


async def _write_and_read_pragmas(
    factory: async_sessionmaker[AsyncSession], index: int
) -> tuple[int, str]:
    async with factory() as session:
        session.add(
            Tag(resource_type="hostedzone", resource_id=f"zpragma{index:03d}", key="k", value="v")
        )
        await session.commit()
        foreign_keys = (await session.execute(text("PRAGMA foreign_keys"))).scalar_one()
        journal_mode = (await session.execute(text("PRAGMA journal_mode"))).scalar_one()
        return int(foreign_keys), str(journal_mode)


async def test_pragmas_apply_to_every_pooled_connection_under_concurrency(
    tmp_path: Path,
) -> None:
    db_path = tmp_path / "pragma_churn.db"
    engine = create_db_engine(f"sqlite+aiosqlite:///{db_path}")
    async with engine.begin() as conn:
        await conn.run_sync(run_migrations_on)

    factory = async_sessionmaker(engine, expire_on_commit=False)
    # More concurrent tasks than any reasonable connection-pool size, so the
    # pool is forced to actually open several distinct DBAPI connections
    # rather than serving everything from one -- the exact churn the
    # connect-listener pattern exists to survive.
    results = await asyncio.gather(
        *(_write_and_read_pragmas(factory, i) for i in range(CONCURRENT_CONNECTIONS))
    )
    await engine.dispose()

    assert len(results) == CONCURRENT_CONNECTIONS
    for foreign_keys, journal_mode in results:
        assert foreign_keys == 1, "PRAGMA foreign_keys was not ON for a pooled connection"
        assert journal_mode.lower() == "wal", "PRAGMA journal_mode was not WAL for a pooled connection"
