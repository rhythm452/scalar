"""users table — account owning hosted zones (docs/DATABASE.md §2)."""

from __future__ import annotations

from typing import Final

from sqlalchemy import CheckConstraint, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDKeyMixin

AWS_ACCOUNT_ID_LENGTH: Final = 12


class User(UUIDKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            f"length(aws_account_id) = {AWS_ACCOUNT_ID_LENGTH} "
            "AND aws_account_id NOT GLOB '*[^0-9]*'",
            name="ck_users_aws_account_id_format",
        ),
        UniqueConstraint("username", name="uq_users_username"),
        UniqueConstraint("email", name="uq_users_email"),
    )

    username: Mapped[str] = mapped_column(String(64))
    email: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    aws_account_id: Mapped[str] = mapped_column(String(16))
    display_name: Mapped[str | None] = mapped_column(String(255))
