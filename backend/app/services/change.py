"""Change service: R11 status derivation on read.

``GET /api/v1/changes/{id}`` reports INSYNC once ``now - submitted_at >= 60s``
and lazily persists the flip; there is no background worker. Change batches
are not owner-scoped in the data model, but the API only exposes lookup by
id (docs/API.md §5), matching real Route 53's unguessable change ids.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import no_such_change
from app.models import ChangeBatch
from app.repositories import ChangeRepository


def default_clock() -> datetime:
    return datetime.now(UTC)


DEFAULT_CLOCK: Callable[[], datetime] = default_clock

INSYNC_AFTER = timedelta(seconds=60)


class ChangeService:
    def __init__(
        self,
        *,
        changes: ChangeRepository,
        clock: Callable[[], datetime] = DEFAULT_CLOCK,
    ) -> None:
        self._changes = changes
        self._clock = clock

    async def get(self, db: AsyncSession, change_id: str) -> ChangeBatch:
        batch = await self._changes.get_by_id(db, change_id)
        if batch is None:
            raise no_such_change(change_id)
        if batch.status == "PENDING" and self._clock() - batch.submitted_at >= INSYNC_AFTER:
            batch.status = "INSYNC"
            await db.commit()
        return batch
