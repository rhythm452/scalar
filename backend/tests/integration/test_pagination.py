"""Cursor pagination over real HTTP (docs/API.md §9): walking every page
of the seeded corpus hits no duplicates, no gaps, stable ordering, and a
null terminal token.
"""

from __future__ import annotations

from httpx import AsyncClient

MAX_PAGES = 50  # guards against an infinite loop if next_token ever cycles


async def _walk(client: AsyncClient, url: str, page_size: int) -> list[str]:
    ids: list[str] = []
    next_token: str | None = None
    for _ in range(MAX_PAGES):
        params: dict[str, str | int] = {"page_size": page_size}
        if next_token:
            params["next_token"] = next_token
        response = await client.get(url, params=params)
        assert response.status_code == 200
        body = response.json()
        ids.extend(item["id"] for item in body["items"])
        next_token = body["next_token"]
        if next_token is None:
            return ids
    raise AssertionError("pagination did not terminate within MAX_PAGES")


async def test_zone_pagination_covers_every_zone_once(seeded_client: AsyncClient) -> None:
    ids = await _walk(seeded_client, "/api/v1/hostedzones", page_size=4)
    assert len(ids) == 14
    assert len(set(ids)) == 14


async def test_zone_pagination_matches_single_large_page(seeded_client: AsyncClient) -> None:
    walked = await _walk(seeded_client, "/api/v1/hostedzones", page_size=3)
    single_page = (
        await seeded_client.get("/api/v1/hostedzones", params={"page_size": 100})
    ).json()["items"]
    assert walked == [z["id"] for z in single_page]


async def test_zone_list_sorted_ascending_by_name_is_stable(seeded_client: AsyncClient) -> None:
    response = await seeded_client.get(
        "/api/v1/hostedzones", params={"page_size": 100, "sort_by": "name", "sort_order": "asc"}
    )
    names = [z["name"] for z in response.json()["items"]]
    assert names == sorted(names)


async def test_zone_list_terminal_token_is_null_when_everything_fits(
    seeded_client: AsyncClient,
) -> None:
    response = await seeded_client.get("/api/v1/hostedzones", params={"page_size": 100})
    assert response.json()["next_token"] is None


async def test_record_pagination_covers_every_record_in_the_demo_zone_once(
    seeded_client: AsyncClient, demo_zone_id: str
) -> None:
    zone = (await seeded_client.get(f"/api/v1/hostedzones/{demo_zone_id}")).json()["zone"]
    ids = await _walk(seeded_client, f"/api/v1/hostedzones/{demo_zone_id}/rrsets", page_size=7)
    assert len(ids) == zone["record_set_count"]
    assert len(set(ids)) == len(ids)


async def test_record_pagination_matches_single_large_page(
    seeded_client: AsyncClient, demo_zone_id: str
) -> None:
    walked = await _walk(seeded_client, f"/api/v1/hostedzones/{demo_zone_id}/rrsets", page_size=9)
    single_page = (
        await seeded_client.get(
            f"/api/v1/hostedzones/{demo_zone_id}/rrsets", params={"page_size": 100}
        )
    ).json()["items"]
    assert walked == [r["id"] for r in single_page]


async def test_invalid_pagination_token_returns_invalid_input(seeded_client: AsyncClient) -> None:
    response = await seeded_client.get(
        "/api/v1/hostedzones", params={"next_token": "not-a-valid-token"}
    )
    assert response.status_code == 400
    assert response.json()["Error"]["Code"] == "InvalidInput"
