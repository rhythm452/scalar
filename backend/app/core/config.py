"""Application configuration.

No CORS middleware is registered: `frontend/src/middleware.ts` proxies /api/*
from the same origin in every environment (local `next dev` included, per
docker-compose.yml), so cross-origin preflights never occur.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./data/app.db"
    session_cookie_name: str = "r53_session"
    session_expire_hours: int = 24
    seed_on_boot: bool = False
    log_level: str = "info"
    # Off by default for local http development (docs/ARCHITECTURE.md §7); a
    # Secure cookie is silently dropped by the browser over plain http, which
    # otherwise makes login look broken with no visible error. Fly.io sets
    # this to true in production, where the app is only ever served over https.
    cookie_secure: bool = False


settings = Settings()
