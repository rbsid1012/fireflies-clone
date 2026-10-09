from datetime import datetime

from sqlalchemy import JSON, Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UTCDateTime, utcnow


class ApiKey(Base):
    """A personal API key for the REST API (Settings -> MCP & API). Only a hash is stored."""

    __tablename__ = "api_keys"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    prefix: Mapped[str] = mapped_column(String(16))  # shown in the UI to tell keys apart
    key_hash: Mapped[str] = mapped_column(String(64), unique=True)  # sha256 hex
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    last_used_at: Mapped[datetime | None] = mapped_column(UTCDateTime())


class Integration(Base):
    """An outbound integration: a Slack incoming webhook or a generic signed webhook."""

    __tablename__ = "integrations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # 'slack' | 'webhook'
    name: Mapped[str] = mapped_column(String(80))
    config: Mapped[dict] = mapped_column(JSON, default=dict)  # {"url": ..., "secret": ...}
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_status: Mapped[str | None] = mapped_column(String(200))
    last_run_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)

    @property
    def secret(self) -> str | None:
        return self.config.get("secret")

    @property
    def url_host(self) -> str:
        """Only the host is shown in lists; the full URL (often a secret itself) is never returned."""
        from urllib.parse import urlparse

        return urlparse(self.config.get("url", "")).hostname or ""


class EmailLog(Base):
    """Every email the app tried to send, whatever the transport. Doubles as a visible outbox."""

    __tablename__ = "email_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    meeting_id: Mapped[int | None] = mapped_column(ForeignKey("meetings.id", ondelete="SET NULL"))
    to_email: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str] = mapped_column(String(300))
    html: Mapped[str] = mapped_column(Text)
    text: Mapped[str] = mapped_column(Text)
    transport: Mapped[str] = mapped_column(String(20))  # 'smtp' | 'resend' | 'log'
    status: Mapped[str] = mapped_column(String(20))  # 'sent' | 'logged' | 'failed'
    error: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


__all__ = ["ApiKey", "EmailLog", "Integration"]
