from datetime import date, datetime

from sqlalchemy import Boolean, Date, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UTCDateTime, utcnow
from app.models.meeting import Meeting, MeetingParticipant
from app.models.transcript import TranscriptSegment


class ActionItem(Base):
    __tablename__ = "action_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), index=True
    )
    text: Mapped[str] = mapped_column(Text)
    assignee_participant_id: Mapped[int | None] = mapped_column(
        ForeignKey("meeting_participants.id", ondelete="SET NULL")
    )
    # Lets the UI jump from an action item to where it was said.
    source_segment_id: Mapped[int | None] = mapped_column(
        ForeignKey("transcript_segments.id", ondelete="SET NULL")
    )
    due_date: Mapped[date | None] = mapped_column(Date)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), default=utcnow, onupdate=utcnow
    )

    meeting: Mapped["Meeting"] = relationship(foreign_keys=[meeting_id], viewonly=True)

    @property
    def meeting_title(self) -> str:
        return self.meeting.title

    @property
    def meeting_started_at(self):
        return self.meeting.started_at

    assignee: Mapped[MeetingParticipant | None] = relationship(
        foreign_keys=[assignee_participant_id]
    )
    source_segment: Mapped[TranscriptSegment | None] = relationship(
        foreign_keys=[source_segment_id]
    )

    @property
    def source_start_ms(self) -> int | None:
        return self.source_segment.start_ms if self.source_segment else None
