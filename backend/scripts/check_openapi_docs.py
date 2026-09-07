"""make doctor check: every route FastAPI actually registers must be
documented in docs/API.md, and vice versa -- a route can drift out of sync
with its own spec silently otherwise. Path parameter *names* differ between
the two on purpose (docs/API.md uses short {id}/{rid}; the implementation
uses descriptive {zone_id}/{record_id}), so parameters are normalised to a
single `{}` placeholder before comparing path *shape*.

Exits non-zero and prints the actual diff on any mismatch.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
API_DOC = REPO_ROOT / "docs" / "API.md"

METHODS = ("GET", "POST", "PUT", "DELETE", "PATCH")
ROUTE_PATTERN = re.compile(r"\b(" + "|".join(METHODS) + r")\s+(/api/v1/[^\s|`)]+)")


def _normalise(method: str, path: str) -> str:
    shape = re.sub(r"\{[^}]+\}", "{}", path.rstrip("/"))
    return f"{method.upper()} {shape}"


def documented_routes() -> set[str]:
    text = API_DOC.read_text(encoding="utf-8")
    return {_normalise(m, p) for m, p in ROUTE_PATTERN.findall(text)}


def registered_routes() -> set[str]:
    from app.main import app

    routes: set[str] = set()
    for path, methods in app.openapi()["paths"].items():
        for method in methods:
            if method.upper() in METHODS:
                routes.add(_normalise(method, path))
    return routes


def main() -> int:
    documented = documented_routes()
    registered = registered_routes()

    missing_from_docs = sorted(registered - documented)
    missing_from_app = sorted(documented - registered)

    if not missing_from_docs and not missing_from_app:
        print(f"OK: {len(registered)} registered routes all match docs/API.md")
        return 0

    if missing_from_docs:
        print("Registered but not documented in docs/API.md:")
        for route in missing_from_docs:
            print(f"  {route}")
    if missing_from_app:
        print("Documented in docs/API.md but not registered:")
        for route in missing_from_app:
            print(f"  {route}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
