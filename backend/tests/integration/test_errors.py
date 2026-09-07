"""AWS error envelope shape over real HTTP (docs/ROUTE53-DOMAIN-RULES.md
§12): the full JSON structure, not just the status code, for one 401, one
404, one 409, and one validation failure.
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient


def _assert_envelope_shape(body: dict, error_type: str, code: str, message: str) -> None:
    assert set(body.keys()) == {"Error", "RequestId"}
    assert set(body["Error"].keys()) == {"Type", "Code", "Message"}
    assert body["Error"]["Type"] == error_type
    assert body["Error"]["Code"] == code
    assert body["Error"]["Message"] == message
    # RequestId must be a real UUID, not a placeholder.
    uuid.UUID(body["RequestId"])


async def test_401_envelope_shape(client: AsyncClient) -> None:
    response = await client.get("/api/v1/hostedzones")
    assert response.status_code == 401
    _assert_envelope_shape(response.json(), "Sender", "NotAuthorized", "No active session.")


async def test_404_envelope_shape(authed_client: AsyncClient) -> None:
    response = await authed_client.get("/api/v1/hostedzones/ZDOESNOTEXIST00000")
    assert response.status_code == 404
    _assert_envelope_shape(
        response.json(),
        "Sender",
        "NoSuchHostedZone",
        "No hosted zone found with id ZDOESNOTEXIST00000.",
    )


async def test_409_envelope_shape(authed_client: AsyncClient) -> None:
    await authed_client.post(
        "/api/v1/hostedzones", json={"name": "conflict.example.com", "type": "public"}
    )
    response = await authed_client.post(
        "/api/v1/hostedzones", json={"name": "conflict.example.com", "type": "public"}
    )
    assert response.status_code == 409
    _assert_envelope_shape(
        response.json(),
        "Sender",
        "HostedZoneAlreadyExists",
        "A hosted zone with name conflict.example.com. and type public "
        "already exists for this account.",
    )


async def test_validation_failure_envelope_shape(authed_client: AsyncClient) -> None:
    response = await authed_client.get("/api/v1/hostedzones?page_size=0")
    assert response.status_code == 422
    body = response.json()
    assert set(body.keys()) == {"Error", "RequestId"}
    assert body["Error"]["Type"] == "Sender"
    assert body["Error"]["Code"] == "ValidationError"
    assert "page_size" in body["Error"]["Message"]
    uuid.UUID(body["RequestId"])


async def test_request_id_is_unique_per_response(client: AsyncClient) -> None:
    first = await client.get("/api/v1/hostedzones")
    second = await client.get("/api/v1/hostedzones")
    assert first.json()["RequestId"] != second.json()["RequestId"]
    assert first.headers["x-request-id"] == first.json()["RequestId"]


async def test_unmatched_route_uses_the_generic_http_exception_handler(
    authed_client: AsyncClient,
) -> None:
    """A route FastAPI itself can't match raises Starlette's HTTPException,
    not a Route53Error -- a different code path through the same handler
    module, so it gets its own test rather than relying on the domain
    404s covered above."""
    response = await authed_client.get("/api/v1/this-route-does-not-exist")
    assert response.status_code == 404
    _assert_envelope_shape(response.json(), "Sender", "NotFound", "Not Found")


async def test_unexpected_exception_becomes_500_internal_error(
    authed_client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from httpx import ASGITransport

    from app.main import app as fastapi_app
    from app.services.hosted_zone import HostedZoneService

    async def _boom(self: HostedZoneService, *args: object, **kwargs: object) -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr(HostedZoneService, "list", _boom)

    # ASGITransport re-raises unhandled app exceptions by default (so a
    # real regression fails the test loudly, as it should everywhere
    # else); this one test needs raise_app_exceptions=False to instead
    # inspect the 500 response the handler sends over the wire.
    transport = ASGITransport(app=fastapi_app, raise_app_exceptions=False)
    async with AsyncClient(
        transport=transport, base_url="http://test", cookies=authed_client.cookies
    ) as silent_client:
        response = await silent_client.get("/api/v1/hostedzones")

    assert response.status_code == 500
    _assert_envelope_shape(
        response.json(), "Receiver", "InternalError", "An internal error occurred."
    )
