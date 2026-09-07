"""Full CRUD round trips over real HTTP for zones and records
(docs/API.md §3-4).
"""

from __future__ import annotations

from httpx import AsyncClient


async def test_zone_crud_round_trip(authed_client: AsyncClient) -> None:
    create = await authed_client.post(
        "/api/v1/hostedzones",
        json={"name": "crud.example.com", "type": "public", "comment": "created by test"},
    )
    assert create.status_code == 201
    zone = create.json()["zone"]
    assert zone["name"] == "crud.example.com."
    assert zone["comment"] == "created by test"
    assert zone["record_set_count"] == 2
    assert create.json()["change"] is None
    zone_id = zone["id"]

    get_response = await authed_client.get(f"/api/v1/hostedzones/{zone_id}")
    assert get_response.status_code == 200
    assert get_response.json()["zone"]["id"] == zone_id
    assert get_response.json()["tags"] == []

    patch_response = await authed_client.patch(
        f"/api/v1/hostedzones/{zone_id}", json={"comment": "updated"}
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["zone"]["comment"] == "updated"

    tags_put = await authed_client.put(
        f"/api/v1/hostedzones/{zone_id}/tags", json={"tags": [{"key": "env", "value": "test"}]}
    )
    assert tags_put.status_code == 200
    assert tags_put.json()["tags"] == [{"key": "env", "value": "test"}]

    tags_get = await authed_client.get(f"/api/v1/hostedzones/{zone_id}/tags")
    assert tags_get.status_code == 200
    assert tags_get.json()["tags"] == [{"key": "env", "value": "test"}]

    list_response = await authed_client.get("/api/v1/hostedzones?search=crud")
    assert list_response.status_code == 200
    assert [z["id"] for z in list_response.json()["items"]] == [zone_id]

    # R3 only guards against *non-system* records; a zone holding only its
    # auto-created NS/SOA is empty and deletable.
    delete_response = await authed_client.delete(f"/api/v1/hostedzones/{zone_id}")
    assert delete_response.status_code == 200
    assert delete_response.json() == {"ok": True}

    after_delete = await authed_client.get(f"/api/v1/hostedzones/{zone_id}")
    assert after_delete.status_code == 404
    assert after_delete.json()["Error"]["Code"] == "NoSuchHostedZone"


async def test_record_crud_round_trip(authed_client: AsyncClient) -> None:
    zone = (
        await authed_client.post(
            "/api/v1/hostedzones", json={"name": "records.example.com", "type": "public"}
        )
    ).json()["zone"]
    zone_id = zone["id"]

    create = await authed_client.post(
        f"/api/v1/hostedzones/{zone_id}/rrsets",
        json={"name": "www", "type": "A", "ttl": 300, "values": ["192.0.2.1", "192.0.2.2"]},
    )
    assert create.status_code == 201
    body = create.json()
    assert body["record"]["name"] == "www.records.example.com."
    assert body["record"]["values"] == ["192.0.2.1", "192.0.2.2"]
    assert body["change"]["status"] == "PENDING"
    record_id = body["record"]["id"]

    update = await authed_client.put(
        f"/api/v1/hostedzones/{zone_id}/rrsets/{record_id}",
        json={"name": "www", "type": "A", "ttl": 600, "values": ["192.0.2.9"]},
    )
    assert update.status_code == 200
    assert update.json()["record"]["ttl"] == 600
    assert update.json()["record"]["values"] == ["192.0.2.9"]

    list_response = await authed_client.get(f"/api/v1/hostedzones/{zone_id}/rrsets?type=A")
    assert list_response.status_code == 200
    names = {r["name"] for r in list_response.json()["items"]}
    assert "www.records.example.com." in names

    delete = await authed_client.delete(f"/api/v1/hostedzones/{zone_id}/rrsets/{record_id}")
    assert delete.status_code == 200
    assert delete.json()["change"]["status"] == "PENDING"

    after = await authed_client.get(f"/api/v1/hostedzones/{zone_id}/rrsets?type=A")
    assert after.json()["items"] == []


async def test_record_batch_round_trip(authed_client: AsyncClient) -> None:
    zone_id = (
        await authed_client.post(
            "/api/v1/hostedzones", json={"name": "batch.example.com", "type": "public"}
        )
    ).json()["zone"]["id"]

    batch = await authed_client.post(
        f"/api/v1/hostedzones/{zone_id}/rrsets/batch",
        json={
            "changes": [
                {
                    "action": "CREATE",
                    "record": {
                        "name": "b1",
                        "type": "A",
                        "ttl": 300,
                        "values": ["192.0.2.1"],
                    },
                },
                {
                    "action": "CREATE",
                    "record": {
                        "name": "b2",
                        "type": "A",
                        "ttl": 300,
                        "values": ["192.0.2.2"],
                    },
                },
            ]
        },
    )
    assert batch.status_code == 200
    assert batch.json()["change"]["status"] == "PENDING"
    assert len(batch.json()["results"]) == 2

    listing = await authed_client.get(f"/api/v1/hostedzones/{zone_id}/rrsets?type=A")
    names = {r["name"] for r in listing.json()["items"]}
    assert {"b1.batch.example.com.", "b2.batch.example.com."} <= names


async def test_change_lookup(authed_client: AsyncClient) -> None:
    zone_id = (
        await authed_client.post(
            "/api/v1/hostedzones", json={"name": "changelookup.example.com", "type": "public"}
        )
    ).json()["zone"]["id"]
    create = await authed_client.post(
        f"/api/v1/hostedzones/{zone_id}/rrsets",
        json={"name": "www", "type": "A", "ttl": 300, "values": ["192.0.2.1"]},
    )
    change_id = create.json()["change"]["id"]

    response = await authed_client.get(f"/api/v1/changes/{change_id}")
    assert response.status_code == 200
    change = response.json()["change"]
    assert change["id"] == change_id
    assert change["hosted_zone_id"] == zone_id
    assert change["status"] == "PENDING"


async def test_mocked_endpoints_return_empty_collections(authed_client: AsyncClient) -> None:
    health_checks = await authed_client.get("/api/v1/health-checks")
    assert health_checks.status_code == 200
    assert health_checks.json() == {"items": [], "next_token": None}

    traffic_policies = await authed_client.get("/api/v1/traffic-policies")
    assert traffic_policies.status_code == 200
    assert traffic_policies.json() == {"items": [], "next_token": None}


async def test_import_export_return_501(authed_client: AsyncClient) -> None:
    zone_id = (
        await authed_client.post(
            "/api/v1/hostedzones", json={"name": "importexport.example.com", "type": "public"}
        )
    ).json()["zone"]["id"]

    export = await authed_client.get(f"/api/v1/hostedzones/{zone_id}/export")
    assert export.status_code == 501
    assert export.json()["Error"]["Code"] == "NotImplemented"
