"""Application configuration.

CORS exists only for the local `next dev` path. In production the Cloudflare
Worker proxies /api/* from the same origin, so cross-origin preflights never
occur and CORS_ORIGINS defaults to empty.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./data/app.db"
    cors_origins: str = ""
    session_cookie_name: str = "r53_session"
    session_expire_hours: int = 24
    seed_on_boot: bool = False
    log_level: str = "info"
    # Off for local http development (docs/ARCHITECTURE.md §7); a Secure
    # cookie is silently dropped by the browser over plain http, which
    # otherwise makes login look broken with no visible error.
    cookie_secure: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        if not self.cors_origins:
            return []
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
