"""Import-direction contract (docs/ARCHITECTURE.md §2): dependencies point
inward toward models. Checked statically over each file's own `import`
statements (not via sys.modules) so a transitive import through another
module can't hide a real violation, and so this has no side effects.

This is the test that would have caught routers reaching into
app.repositories directly for values/summary queries instead of going
through a service method -- found and fixed in this same phase.
"""

from __future__ import annotations

import ast
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[2] / "app"


def _imported_modules(path: Path) -> set[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    modules: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.add(node.module)
    return modules


def _files(package: str) -> list[Path]:
    return sorted((APP_DIR / package).glob("*.py"))


def _assert_none_start_with(modules: set[str], *prefixes: str, path: Path) -> None:
    hits = {m for m in modules for p in prefixes if m == p or m.startswith(p + ".")}
    assert not hits, f"{path}: forbidden import(s) {sorted(hits)}"


def test_models_do_not_import_upward() -> None:
    for path in _files("models"):
        modules = _imported_modules(path)
        _assert_none_start_with(
            modules, "app.schemas", "app.services", "app.repositories", "app.api", path=path
        )


def test_repositories_do_not_import_services_or_api() -> None:
    for path in _files("repositories"):
        modules = _imported_modules(path)
        _assert_none_start_with(modules, "app.services", "app.api", path=path)


def test_services_never_import_fastapi_or_api() -> None:
    for path in _files("services"):
        modules = _imported_modules(path)
        _assert_none_start_with(modules, "fastapi", "starlette", "app.api", path=path)


def test_schemas_do_not_import_sqlalchemy() -> None:
    """Pydantic-only per docs/ARCHITECTURE.md §2. Plain value tuples
    imported from app.models (RECORD_TYPES, ROUTING_POLICIES, ZONE_TYPES)
    are the one sanctioned exception -- the phase-2 brief asks schemas to
    reuse those rather than redeclare them -- so this checks for the ORM
    engine itself, which is the thing the rule actually guards against.
    """
    for path in _files("schemas"):
        modules = _imported_modules(path)
        _assert_none_start_with(modules, "sqlalchemy", "app.services", "app.api", path=path)


def test_routers_only_reach_the_service_layer() -> None:
    """Routers may import services, schemas, and core deps -- not
    repositories or models' ORM classes directly (docs/ARCHITECTURE.md
    §2). `app.models` import is allowed only for plain type constants,
    which this check can't distinguish from an ORM class import, so it
    checks the stricter, unambiguous case: no app.repositories at all.
    """
    v1_dir = APP_DIR / "api" / "v1"
    for path in sorted(v1_dir.glob("*.py")):
        modules = _imported_modules(path)
        _assert_none_start_with(modules, "app.repositories", path=path)
