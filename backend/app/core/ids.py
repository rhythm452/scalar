"""AWS-format ID generation (docs/DATABASE.md §1).

Hosted zone ids are `Z` + 13 uppercase alphanumerics, change ids `C` + 13,
both drawn from `secrets` over `[A-Z0-9]`. Mock AWS account ids are 12
digits. Generation is pure; collision checking against the database
happens in the service inside the creating transaction.
"""

from __future__ import annotations

import secrets
from typing import Final

ALPHABET: Final = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
ID_BODY_LENGTH: Final = 13
ACCOUNT_ID_LENGTH: Final = 12


def _aws_id(prefix: str) -> str:
    body = "".join(secrets.choice(ALPHABET) for _ in range(ID_BODY_LENGTH))
    return f"{prefix}{body}"


def new_hosted_zone_id() -> str:
    """`Z` + 13 uppercase alphanumerics, e.g. `Z3P5ZZXAMPLE0AB`."""
    return _aws_id("Z")


def new_change_id() -> str:
    """`C` + 13 uppercase alphanumerics, e.g. `C1Q6ZZXAMPLE0AB`."""
    return _aws_id("C")


def new_aws_account_id() -> str:
    """Mock 12-digit AWS account id, e.g. `123456789012`."""
    return "".join(secrets.choice("0123456789") for _ in range(ACCOUNT_ID_LENGTH))


def new_caller_reference() -> str:
    """Idempotency key mirroring real Route 53's CallerReference."""
    return secrets.token_hex(16)


def new_session_token() -> str:
    """Raw opaque session token; only its SHA-256 hash is stored."""
    return secrets.token_urlsafe(32)
