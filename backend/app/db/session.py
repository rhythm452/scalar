"""Engine and session factory.

SQLite pragmas (foreign_keys ON, journal_mode WAL) are applied on every
connection via an event listener, never once at startup, per
docs/DATABASE.md §1.4 and ADR-002.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Final

from sqlalchemy import event
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import ConnectionPoolEntry

from app.core.config import settings

PRAGMAS: Final = ("PRAGMA foreign_keys=ON", "PRAGMA journal_mode=WAL")


def _async_url(url: str) -> str:
    """Alembic and settings use sync ``sqlite://`` URLs; the async engine
    needs the aiosqlite driver, so bare sqlite URLs are rewritten here."""
    if url.startswith("sqlite://") and not url.startswith("sqlite+"):
        return url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    return url


def _apply_sqlite_pragmas(
    dbapi_connection: DBAPIConnection, _connection_record: ConnectionPoolEntry
) -> None:
    cursor = dbapi_connection.cursor()
    try:
        for pragma in PRAGMAS:
            cursor.execute(pragma)
    finally:
        cursor.close()


def create_db_engine(url: str) -> AsyncEngine:
    engine = create_async_engine(_async_url(url))
    event.listen(engine.sync_engine, "connect", _apply_sqlite_pragmas)
    return engine


engine = create_db_engine(settings.database_url)
session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """One session per request; owned by callers (services commit)."""
    async with session_factory() as session:
        yield session
