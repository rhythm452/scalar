"""Mocked-endpoint response schemas (docs/API.md §7): well-formed empty
collections in the real envelope shape, and the dashboard summary."""

from __future__ import annotations

from pydantic import BaseModel

from app.schemas.common import PageEnvelope


class MockedItem(BaseModel):
    """Placeholder item shape; health-checks and traffic-policies are
    always empty collections in this contest scope."""


MockedListResponse = PageEnvelope[MockedItem]


class DashboardSummary(BaseModel):
    zones: int
    records: int
    health_checks: int = 0
    traffic_policies: int = 0
