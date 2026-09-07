"""Shared response envelope and validation helpers (docs/API.md §9).

Pydantic-only per docs/ARCHITECTURE.md §2. Field-level enum validators use
``one_of`` so a resource's schema module can reuse the plain value tuples
the models already define (docs/API.md Part B) without redeclaring them.
"""

from __future__ import annotations

from collections.abc import Iterable

from pydantic import AfterValidator, BaseModel


def one_of(allowed: Iterable[str]) -> AfterValidator:
    """Build a field validator rejecting any value outside ``allowed``."""
    allowed_set = frozenset(allowed)

    def _check(value: str) -> str:
        if value not in allowed_set:
            raise ValueError(f"must be one of {sorted(allowed_set)}")
        return value

    return AfterValidator(_check)


class PageEnvelope[T](BaseModel):
    """Cursor pagination envelope (docs/API.md §9, ADR-003)."""

    items: list[T]
    next_token: str | None = None


class OkResponse(BaseModel):
    ok: bool = True
