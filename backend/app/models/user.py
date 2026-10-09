from datetime import datetime

from sqlalchemy import JSON, Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UTCDateTime, utcnow


class User(Base):
    """The app owner. One seeded default user; there is no real auth."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    # NULL for accounts that only use Google sign-in or the demo login
    password_hash: Mapped[str | None] = mapped_column(String(255))
    google_sub: Mapped[str | None] = mapped_column(String(64), unique=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    # Per-section preferences; validated and defaulted by schemas.settings.UserSettings
    settings: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)

    @property
    def has_password(self) -> bool:
        return self.password_hash is not None


class Person(Base):
    """Anyone who appears in meetings. One row per human across all meetings."""

    __tablename__ = "people"
    __table_args__ = (UniqueConstraint("owner_id", "email"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    # People are private to the account whose meetings they appear in
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    # NULL emails are allowed and, in SQLite, are never equal to each other,
    # so UNIQUE(owner_id, email) is exactly "unique per account where not null".
    email: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
