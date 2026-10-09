import enum
from datetime import datetime

from sqlalchemy import JSON, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UTCDateTime, str_enum, utcnow


class SummarySource(str, enum.Enum):
    seed = "seed"
    heuristic = "heuristic"
    llm = "llm"


class Summary(Base):
    """1:1 with a meeting, kept separate so regenerating never touches metadata."""

    __tablename__ = "summaries"

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), unique=True
    )
    overview: Mapped[str] = mapped_column(Text, default="")
    keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    generated_by: Mapped[SummarySource] = mapped_column(str_enum(SummarySource, "summary_source"))
    generated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class Chapter(Base):
    """An 'Outline' entry in the UI."""

    __tablename__ = "chapters"

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(
        ForeignKey("meetings.id", ondelete="CASCADE"), index=True
    )
    seq: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(255))
    start_ms: Mapped[int] = mapped_column(Integer)
    summary: Mapped[str | None] = mapped_column(Text)
