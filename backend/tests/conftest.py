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
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from alembic import command
from app.core.config import settings
from app.core.deps import get_db as app_get_db
from app.core.security import hash_password
from app.main import app as fastapi_app
from app.models import User
from app.repositories import (
    change_repository,
    hosted_zone_repository,
    record_repository,
    session_repository,
    tag_repository,
    user_repository,
)
from app.seed.seed import run_seed
from app.services.auth import AuthService
from app.services.change import ChangeService
from app.services.hosted_zone import HostedZoneService
from app.services.record import RecordService
from app.services.tag import TagService

BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_DIR = BACKEND_DIR / "alembic"

T0 = datetime(2026, 9, 7, 12, 0, 0, tzinfo=UTC)
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "password123"


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
def auth_service(services: dict[str, object]) -> AuthService:
    svc = services["auth"]
    assert isinstance(svc, AuthService)
    return svc


@pytest.fixture
def zone_service(services: dict[str, object]) -> HostedZoneService:
    svc = services["zones"]
    assert isinstance(svc, HostedZoneService)
    return svc


@pytest.fixture
def record_service(services: dict[str, object]) -> RecordService:
    svc = services["records"]
    assert isinstance(svc, RecordService)
    return svc


@pytest.fixture
def change_service(services: dict[str, object]) -> ChangeService:
    svc = services["changes"]
    assert isinstance(svc, ChangeService)
    return svc


@pytest.fixture
def tag_service(services: dict[str, object]) -> TagService:
    svc = services["tags"]
    assert isinstance(svc, TagService)
    return svc


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
async def zone(zone_service: HostedZoneService, user: User, db: AsyncSession) -> object:
    zone = await zone_service.create(db, user, name="example.com", zone_type="public")
    await db.commit()
    return zone


@pytest.fixture
async def client(
    engine: AsyncEngine, monkeypatch: pytest.MonkeyPatch
) -> AsyncIterator[AsyncClient]:
    """httpx client against the real ASGI app, `get_db` overridden to this
    test's migrated in-memory engine instead of the file-backed default.

    `cookie_secure` is forced off: httpx's cookie jar enforces the Secure
    flag exactly like a browser, so a Secure cookie set over the client's
    plain-http base_url would never be sent back on later requests in the
    same test (docs/ARCHITECTURE.md §7 -- this is the exact local-dev
    footgun that setting exists to avoid).
    """
    monkeypatch.setattr(settings, "cookie_secure", False)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with factory() as session:
            yield session

    fastapi_app.dependency_overrides[app_get_db] = override_get_db
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    fastapi_app.dependency_overrides.clear()


@pytest.fixture
async def authed_client(client: AsyncClient, user: User) -> AsyncClient:
    """`client`, already logged in as the seeded admin fixture user."""
    response = await client.post(
        "/api/v1/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, response.text
    return client


@pytest.fixture
async def demo_zone_id(seeded_client: AsyncClient) -> str:
    """The id of the seeded `example.com.` zone -- the one with 96 record
    sets covering every type and routing policy (docs/DATABASE.md §13)."""
    zones = (
        await seeded_client.get(
            "/api/v1/hostedzones", params={"search": "example.com", "page_size": 100}
        )
    ).json()["items"]
    return next(z["id"] for z in zones if z["name"] == "example.com.")


@pytest.fixture
async def seeded_client(client: AsyncClient, engine: AsyncEngine) -> AsyncClient:
    """`client` with the full demo dataset loaded (docs/DATABASE.md §13),
    logged in as the admin/password123 user the seed itself creates."""
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        wrote = await run_seed(session)
    assert wrote is True

    response = await client.post(
        "/api/v1/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200, response.text
    return client
