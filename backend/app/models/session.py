"""sessions table — opaque server-side sessions (docs/DATABASE.md §3)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UTCTimestamp, UUIDKeyMixin


class UserSession(UUIDKeyMixin, Base):
    __tablename__ = "sessions"
    __table_args__ = (Index("ix_sessions_token", "token", unique=True),)

    user_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("users.id", ondelete="CASCADE", name="fk_sessions_user_id_users"),
    )
    token: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(UTCTimestamp)
    created_at: Mapped[datetime] = mapped_column(UTCTimestamp)
    last_seen_at: Mapped[datetime] = mapped_column(UTCTimestamp)
