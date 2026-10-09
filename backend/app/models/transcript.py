from sqlalchemy import ForeignKey, Index, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.meeting import MeetingParticipant


class TranscriptSegment(Base):
    """One utterance. All timestamps are integer milliseconds from meeting start.

    The `transcript_fts` FTS5 table mirrors this table via triggers; it is
    created in the Alembic migration, not declared here.
    """

    __tablename__ = "transcript_segments"
    __table_args__ = (
        UniqueConstraint("meeting_id", "seq"),
        Index("ix_transcript_segments_meeting_start", "meeting_id", "start_ms"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    participant_id: Mapped[int | None] = mapped_column(
        ForeignKey("meeting_participants.id", ondelete="SET NULL")
    )
    seq: Mapped[int] = mapped_column(Integer)
    start_ms: Mapped[int] = mapped_column(Integer)
    end_ms: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)

    participant: Mapped[MeetingParticipant | None] = relationship()

    @property
    def speaker_label(self) -> str | None:
        return self.participant.speaker_label if self.participant else None

    @property
    def speaker_name(self) -> str | None:
        return self.participant.name if self.participant else None

    @property
    def color_index(self) -> int:
        return self.participant.color_index if self.participant else 0
