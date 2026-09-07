"""Opaque cursor pagination (docs/API.md §9, ADR-003).

Tokens are base64url-encoded JSON ``{"v": <sort value>, "i": <id>}`` of the
last item on the page. Clients pass ``next_token`` unchanged; tampered
tokens raise ``InvalidInput``. Ties break on the id column so ordering is
deterministic and pages contain no gaps or duplicates while data mutates.
"""

from __future__ import annotations

import base64
import json
from collections.abc import Callable
from typing import Any

from sqlalchemy import ColumnElement, and_, or_

from app.core.errors import invalid_input

SortValue = str | int


def encode_token(sort_value: SortValue, item_id: str) -> str:
    payload = json.dumps({"v": sort_value, "i": item_id}, separators=(",", ":"))
    return base64.urlsafe_b64encode(payload.encode()).decode("ascii").rstrip("=")


def decode_token(token: str) -> tuple[SortValue, str]:
    """Decode a cursor token; raises InvalidInput on tampering."""
    padded = token + "=" * (-len(token) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))
        sort_value = payload["v"]
        item_id = payload["i"]
    except (KeyError, ValueError, UnicodeError, json.JSONDecodeError):
        raise invalid_input("Invalid pagination token.") from None
    if not isinstance(sort_value, (str, int)) or not isinstance(item_id, str):
        raise invalid_input("Invalid pagination token.")
    return sort_value, item_id


def cursor_filter(
    sort_column: Any,
    id_column: Any,
    sort_value: SortValue,
    item_id: str,
    *,
    ascending: bool,
) -> ColumnElement[bool]:
    """Keyset predicate continuing strictly after (sort_value, item_id).

    Params are typed ``Any`` because SQLAlchemy instrumented attributes do
    not line up with ColumnElement under mypy strict; both accept the same
    comparison operators.
    """
    if ascending:
        return or_(
            sort_column > sort_value,
            and_(sort_column == sort_value, id_column > item_id),
        )
    return or_(
        sort_column < sort_value,
        and_(sort_column == sort_value, id_column < item_id),
    )


def page_result[T](
    items: list[T], page_size: int, last_item: Callable[[], tuple[SortValue, str]]
) -> tuple[list[T], str | None]:
    """Slice a page_size + 1 fetch into items plus the next token, if any."""
    if len(items) > page_size:
        items = items[:page_size]
        sort_value, item_id = last_item()
        return items, encode_token(sort_value, item_id)
    return items, None
