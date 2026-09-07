"""Security helpers (docs/ARCHITECTURE.md §7).

Password hashing uses passlib with argon2 (prompt-mandated upgrade over the
bcrypt mentions in the docs; the doc sections are updated in the same
commit). Session tokens are ``secrets.token_urlsafe(32)``; only the SHA-256
hex digest is stored (``sessions.token`` is String(64)).
"""

from __future__ import annotations

import hashlib
import secrets
from typing import Final

from passlib.context import CryptContext

_PASSWORD_CONTEXT: Final = CryptContext(schemes=["argon2"], deprecated="auto")
SESSION_TOKEN_BYTES: Final = 32


def hash_password(password: str) -> str:
    hashed: str = _PASSWORD_CONTEXT.hash(password)
    return hashed


def verify_password(password: str, password_hash: str) -> bool:
    try:
        result: bool = _PASSWORD_CONTEXT.verify(password, password_hash)
        return result
    except (ValueError, TypeError):
        return False


def new_session_token() -> str:
    return secrets.token_urlsafe(SESSION_TOKEN_BYTES)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
