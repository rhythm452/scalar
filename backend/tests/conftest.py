"""Shared fixtures: a migrated in-memory database per test, a frozen clock,
wired services, and a seeded demo zone.

The migrations run through Alembic against each test's own connection
(``config.attributes["connection"]``), never ``create_all`` — the schema
under test is the same one production boots with (docs/DATABASE.md §12).
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from datetime import UTC, datetime
from pathlib import Path

import pytest
from alembic.config import Config
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from alembic import command
from app.core.security import hash_password
from app.models import User
from app.repositories import (
    change_repository,
    hosted_zone_repository,
    record_repository,
    session_repository,
    tag_repository,
    user_repository,
)
from app.services.auth import AuthService
from app.services.change import ChangeService
from app.services.hosted_zone import HostedZoneService
from app.services.record import RecordService
from app.services.tag import TagService

BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_DIR = BACKEND_DIR / "alembic"

T0 = datetime(2026, 9, 7, 12, 0, 0, tzinfo=UTC)


def run_migrations_on(connection: object) -> None:
    """Upgrade to head over an existing (in-memory) connection."""
    cfg = Config()
    cfg.set_main_option("script_location", str(ALEMBIC_DIR))
    cfg.attributes["connection"] = connection
    command.upgrade(cfg, "head")


@pytest.fixture
async def engine() -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)
    async with engine.begin() as conn:
        await conn.run_sync(run_migrations_on)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest.fixture
def clock() -> Callable[[], datetime]:
    frozen: dict[str, datetime] = {"now": T0}

    def now() -> datetime:
        return frozen["now"]

    now.at = lambda value: frozen.update(now=value)  # type: ignore[attr-defined]
    return now


@pytest.fixture
def services(clock: Callable[[], datetime]) -> dict[str, object]:
    return {
        "auth": AuthService(users=user_repository, sessions=session_repository, clock=clock),
        "zones": HostedZoneService(
            zones=hosted_zone_repository,
            records=record_repository,
            tags=tag_repository,
            clock=clock,
        ),
        "records": RecordService(
            zones=hosted_zone_repository,
            records=record_repository,
            changes=change_repository,
            clock=clock,
        ),
        "changes": ChangeService(changes=change_repository, clock=clock),
        "tags": TagService(zones=hosted_zone_repository, tags=tag_repository),
    }


@pytest.fixture
async def user(db: AsyncSession) -> User:
    user = User(
        id="u0000000000000000000000000001",
        username="admin",
        email="admin@example.com",
        password_hash=hash_password("password123"),
        aws_account_id="123456789012",
        display_name="Admin",
        created_at=T0,
        updated_at=T0,
    )
    await user_repository.insert(db, user)
    await db.commit()
    return user


@pytest.fixture
async def zone(services: dict[str, object], user: User, db: AsyncSession) -> object:
    zone_service = services["zones"]
    assert isinstance(zone_service, HostedZoneService)
    zone = await zone_service.create(db, user, name="example.com", zone_type="public")
    await db.commit()
    return zone
