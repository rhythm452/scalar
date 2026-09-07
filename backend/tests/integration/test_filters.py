"""Each search/filter/sort parameter actually changes the result set
(docs/API.md §3-4, §9), checked against the seeded demo corpus.
"""

from __future__ import annotations

from httpx import AsyncClient


async def test_zone_search_narrows_the_list(seeded_client: AsyncClient) -> None:
    all_zones = (await seeded_client.get("/api/v1/hostedzones", params={"page_size": 100})).json()[
        "items"
    ]
    filtered = (
        await seeded_client.get(
            "/api/v1/hostedzones", params={"search": "scalar", "page_size": 100}
        )
    ).json()["items"]
    assert 0 < len(filtered) < len(all_zones)
    assert all("scalar" in z["name"] for z in filtered)


async def test_zone_type_filter_selects_only_private_zones(seeded_client: AsyncClient) -> None:
    response = await seeded_client.get(
        "/api/v1/hostedzones", params={"type": "private", "page_size": 100}
    )
    items = response.json()["items"]
    assert len(items) == 2
    assert all(z["type"] == "private" for z in items)


async def test_zone_sort_order_desc_reverses_asc(seeded_client: AsyncClient) -> None:
    asc = (
        await seeded_client.get(
            "/api/v1/hostedzones", params={"page_size": 100, "sort_order": "asc"}
        )
    ).json()["items"]
    desc = (
        await seeded_client.get(
            "/api/v1/hostedzones", params={"page_size": 100, "sort_order": "desc"}
        )
    ).json()["items"]
    assert [z["id"] for z in asc] == [z["id"] for z in reversed(desc)]


async def test_zone_sort_by_record_set_count_orders_numerically(seeded_client: AsyncClient) -> None:
    response = await seeded_client.get(
        "/api/v1/hostedzones",
        params={"page_size": 100, "sort_by": "record_set_count", "sort_order": "desc"},
    )
    counts = [z["record_set_count"] for z in response.json()["items"]]
    assert counts == sorted(counts, reverse=True)
    assert counts[0] > counts[-1]  # the demo zone (96) really does sort above a 2-record zone


async def test_record_type_filter_narrows_results(
    seeded_client: AsyncClient, demo_zone_id: str
) -> None:
    all_records = (
        await seeded_client.get(
            f"/api/v1/hostedzones/{demo_zone_id}/rrsets", params={"page_size": 100}
        )
    ).json()["items"]
    a_only = (
        await seeded_client.get(
            f"/api/v1/hostedzones/{demo_zone_id}/rrsets", params={"type": "A", "page_size": 100}
        )
    ).json()["items"]
    assert 0 < len(a_only) < len(all_records)
    assert all(r["type"] == "A" for r in a_only)


async def test_record_alias_only_filter(seeded_client: AsyncClient, demo_zone_id: str) -> None:
    response = await seeded_client.get(
        f"/api/v1/hostedzones/{demo_zone_id}/rrsets",
        params={"alias_only": "true", "page_size": 100},
    )
    items = response.json()["items"]
    assert len(items) == 3
    assert all(r["is_alias"] is True for r in items)


async def test_record_routing_policy_filter(seeded_client: AsyncClient, demo_zone_id: str) -> None:
    response = await seeded_client.get(
        f"/api/v1/hostedzones/{demo_zone_id}/rrsets",
        params={"routing_policy": "weighted", "page_size": 100},
    )
    items = response.json()["items"]
    assert len(items) == 3
    assert all(r["routing_policy"] == "weighted" for r in items)


async def test_record_search_matches_value_not_just_name(
    seeded_client: AsyncClient, demo_zone_id: str
) -> None:
    # "203.0.113" only appears inside the multivalue "edge" records' values,
    # not in any record name, so a hit here proves search covers values too.
    response = await seeded_client.get(
        f"/api/v1/hostedzones/{demo_zone_id}/rrsets",
        params={"search": "203.0.113", "page_size": 100},
    )
    items = response.json()["items"]
    assert len(items) == 3
    assert all(r["name"].startswith("edge.") for r in items)


async def test_record_sort_by_ttl(seeded_client: AsyncClient, demo_zone_id: str) -> None:
    # type=TXT rather than A: three seeded A records are aliases with a
    # NULL ttl, and None doesn't compare against int for this assertion.
    response = await seeded_client.get(
        f"/api/v1/hostedzones/{demo_zone_id}/rrsets",
        params={"sort_by": "ttl", "sort_order": "desc", "page_size": 100, "type": "TXT"},
    )
    ttls = [r["ttl"] for r in response.json()["items"]]
    assert len(ttls) > 1
    assert all(ttl is not None for ttl in ttls)
    assert ttls == sorted(ttls, reverse=True)
