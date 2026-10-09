from dataclasses import dataclass, field
from datetime import date

from app.models import SummarySource


@dataclass
class SegmentInfo:
    """A transcript segment as the summarizers see it (detached from the ORM)."""

    seq: int
    start_ms: int
    end_ms: int
    text: str
    segment_id: int | None = None
    participant_id: int | None = None
    speaker: str | None = None


@dataclass
class ChapterDraft:
    title: str
    start_ms: int
    summary: str | None = None


@dataclass
class ActionItemDraft:
    text: str
    segment_id: int | None = None
    assignee_participant_id: int | None = None
    due_date: date | None = None


@dataclass
class SummaryDraft:
    overview: str
    keywords: list[str]
    chapters: list[ChapterDraft]
    action_items: list[ActionItemDraft] = field(default_factory=list)
    generated_by: SummarySource = SummarySource.heuristic
