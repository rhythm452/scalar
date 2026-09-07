"""Auth flow over real HTTP (docs/API.md §2): login sets the cookie,
session reads it back, logout clears it, protected routes 401 without it.
"""

from __future__ import annotations

from httpx import AsyncClient

from tests.conftest import ADMIN_PASSWORD, ADMIN_USERNAME


async def test_login_sets_cookie_and_returns_user(client: AsyncClient, user) -> None:
    response = await client.post(
        "/api/v1/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["username"] == "admin"
    assert body["user"]["aws_account_id"] == "123456789012"
    assert "expires_at" in body["session"]
    assert client.cookies.get("r53_session") is not None


async def test_login_wrong_password_rejected(client: AsyncClient, user) -> None:
    response = await client.post(
        "/api/v1/auth/login", json={"username": ADMIN_USERNAME, "password": "wrong"}
    )
    assert response.status_code == 401
    assert response.json()["Error"]["Code"] == "NotAuthorized"
    assert response.json()["Error"]["Message"] == "Invalid username or password."


async def test_session_returns_current_user(authed_client: AsyncClient) -> None:
    response = await authed_client.get("/api/v1/auth/session")
    assert response.status_code == 200
    assert response.json()["user"]["username"] == "admin"


async def test_session_without_cookie_is_401(client: AsyncClient) -> None:
    response = await client.get("/api/v1/auth/session")
    assert response.status_code == 401
    assert response.json()["Error"]["Message"] == "No active session."


async def test_logout_clears_the_session(authed_client: AsyncClient) -> None:
    response = await authed_client.post("/api/v1/auth/logout")
    assert response.status_code == 200
    assert response.json() == {"ok": True}

    follow_up = await authed_client.get("/api/v1/auth/session")
    assert follow_up.status_code == 401


async def test_protected_endpoint_401_without_cookie(client: AsyncClient) -> None:
    response = await client.get("/api/v1/hostedzones")
    assert response.status_code == 401
    assert response.json()["Error"]["Code"] == "NotAuthorized"


async def test_health_requires_no_auth_and_matches_documented_shape(client: AsyncClient) -> None:
    """docs/API.md §8: `{ok: true, version: "0.1.0"}`, used by Docker/Fly/CI healthchecks --
    those all parse JSON strictly, so `ok` must be the boolean `true`, not the string `"true"`."""
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True, "version": "0.1.0"}
