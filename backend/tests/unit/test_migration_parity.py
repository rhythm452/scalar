"""Migration/model parity (docs/DATABASE.md §14): the Alembic-upgraded
schema must match Base.metadata.create_all() structurally -- same tables,
columns, types, nullability, indexes, and foreign keys -- so the hand-
written migration in alembic/versions/0001_initial_schema.py can never
silently drift from app/models/*.py.

DATABASE.md §14 previously claimed this test already existed; it did not
(docs: correct claims contradicted by the audit). This makes the claim
true instead of deleting it.
"""

from __future__ import annotations

from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import StaticPool

from app.models import Base
from tests.conftest import run_migrations_on


def _table_shape(metadata: MetaData) -> dict[str, object]:
    shape: dict[str, object] = {}
    for name, table in sorted(metadata.tables.items()):
        if name == "alembic_version":
            continue  # Alembic's own bookkeeping table, not part of the model
        columns = {col.name: (str(col.type).split("(")[0], col.nullable) for col in table.columns}
        indexes = {ix.name for ix in table.indexes}
        foreign_keys = {(fk.parent.name, fk.column.table.name) for fk in table.foreign_keys}
        shape[name] = {"columns": columns, "indexes": indexes, "foreign_keys": foreign_keys}
    return shape


async def test_alembic_schema_matches_model_metadata() -> None:
    migrated_engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)
    async with migrated_engine.begin() as conn:
        await conn.run_sync(run_migrations_on)
        migrated_metadata = MetaData()
        await conn.run_sync(migrated_metadata.reflect)
    await migrated_engine.dispose()

    modelled_engine = create_async_engine("sqlite+aiosqlite://", poolclass=StaticPool)
    async with modelled_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        modelled_metadata = MetaData()
        await conn.run_sync(modelled_metadata.reflect)
    await modelled_engine.dispose()

    migrated_shape = _table_shape(migrated_metadata)
    modelled_shape = _table_shape(modelled_metadata)

    assert set(migrated_shape) == set(modelled_shape)
    for table_name in migrated_shape:
        assert migrated_shape[table_name] == modelled_shape[table_name], table_name
