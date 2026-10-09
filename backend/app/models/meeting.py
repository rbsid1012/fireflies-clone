import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UTCDateTime, str_enum, utcnow
from app.models.tag import Tag
from app.models.user import Person

if TYPE_CHECKING:
    from app.models.action_item import ActionItem
    from app.models.summary import Chapter, Summary


class MeetingSource(str, enum.Enum):
    seed = "seed"
    upload = "upload"
    paste = "paste"
    form = "form"


class MeetingStatus(str, enum.Enum):
    processing = "processing"
    ready = "ready"
    failed = "failed"


class Meeting(Base):
    __tablename__ = "meetings"
    __table_args__ = (Index("ix_meetings_owner_started", "owner_id", "started_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    started_at: Mapped[datetime] = mapped_column(UTCDateTime())
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[MeetingSource] = mapped_column(str_enum(MeetingSource, "meeting_source"))
    media_url: Mapped[str | None] = mapped_column(String(500))
    # Uploaded audio/video lives on disk (MEDIA_DIR); the API serves it through a signed URL
    media_path: Mapped[str | None] = mapped_column(String(500))
    media_type: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[MeetingStatus] = mapped_column(
        str_enum(MeetingStatus, "meeting_status"), default=MeetingStatus.processing
    )
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), default=utcnow, onupdate=utcnow
    )

    # Children are removed by the database (ON DELETE CASCADE); passive_deletes stops
    # the ORM from loading them first just to null out their foreign keys.
    @property
    def media_src(self) -> str | None:
        """What the player should load: our signed endpoint for uploaded media, else any external URL."""
        if self.media_path:
            import hashlib

            from app.security import sign_media

            # `v` changes whenever the file does, so browsers don't serve a cached copy of the old one
            version = hashlib.sha1(self.media_path.encode()).hexdigest()[:8]
            return f"/api/media/{self.id}?sig={sign_media(self.id)}&v={version}"
        return self.media_url

    participants: Mapped[list["MeetingParticipant"]] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", passive_deletes=True,
        order_by="MeetingParticipant.id",
    )
    summary: Mapped["Summary | None"] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, uselist=False
    )
    chapters: Mapped[list["Chapter"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="Chapter.seq"
    )
    action_items: Mapped[list["ActionItem"]] = relationship(
        cascade="all, delete-orphan", passive_deletes=True, order_by="ActionItem.id"
    )
    tags: Mapped[list["Tag"]] = relationship(
        secondary="meeting_tags", order_by=lambda: func.lower(Tag.name)
    )


class MeetingParticipant(Base):
    """A person's presence in one meeting; also what a transcript 'speaker' is."""

    __tablename__ = "meeting_participants"
    __table_args__ = (UniqueConstraint("meeting_id", "person_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id"), index=True)
    # Label as it appeared in the source transcript, e.g. "Speaker 2"
    speaker_label: Mapped[str] = mapped_column(String(120))
    color_index: Mapped[int] = mapped_column(Integer, default=0)

    meeting: Mapped[Meeting] = relationship(back_populates="participants")
    person: Mapped[Person] = relationship()

    @property
    def name(self) -> str:
        return self.person.name

    @property
    def email(self) -> str | None:
        return self.person.email
