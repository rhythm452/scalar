"""Mocked endpoints (docs/API.md §7): well-formed empty collections in the
real envelope shape, and a dashboard summary built from real counts. Phase
6's Coming Soon pages render these as a real empty state, not an error.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession, ZoneServiceDep
from app.schemas.mocked import DashboardSummary, MockedListResponse

router = APIRouter(tags=["mocked"])


@router.get("/health-checks", response_model=MockedListResponse)
async def list_health_checks(_current_user: CurrentUser) -> MockedListResponse:
    return MockedListResponse(items=[], next_token=None)


@router.get("/traffic-policies", response_model=MockedListResponse)
async def list_traffic_policies(_current_user: CurrentUser) -> MockedListResponse:
    return MockedListResponse(items=[], next_token=None)


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def dashboard_summary(
    db: DbSession, current_user: CurrentUser, zones: ZoneServiceDep
) -> DashboardSummary:
    zone_count, record_count = await zones.summary_for_owner(db, current_user)
    return DashboardSummary(zones=zone_count, records=record_count)
