"""Generate a summary (LLM if configured, heuristic otherwise) and persist it."""
import logging
import re
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ActionItem, Chapter, Meeting, Summary, TranscriptSegment
from app.models.base import utcnow
from app.schemas.settings import AISettings
from app.services.llm_client import LLMClient, LLMError
from app.services.summary_heuristic import summarize_heuristic
from app.services.summary_llm import summarize_llm
from app.services.summary_types import SegmentInfo, SummaryDraft

log = logging.getLogger(__name__)


def load_segments(db: Session, meeting_id: int) -> list[SegmentInfo]:
    rows = db.scalars(
        select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id)
        .order_by(TranscriptSegment.seq)
    ).all()
    return [
        SegmentInfo(r.seq, r.start_ms, r.end_ms, r.text, r.id, r.participant_id, r.speaker_name)
        for r in rows
    ]


def generate_summary(
    segments: list[SegmentInfo], started_at: datetime, llm: LLMClient | None, ai: AISettings | None = None,
    language: str = "en", focus: str = "",
) -> SummaryDraft:
    """Use the LLM when available; on any LLM failure fall back so the app never breaks.
    `ai` carries the user's summary preferences (style, instructions, action item extraction)."""
    if llm is not None:
        try:
            return summarize_llm(llm, segments, started_at, ai, language, focus)
        except LLMError as exc:
            log.warning("LLM summary failed, using heuristic: %s", exc)
    if ai is None:
        return summarize_heuristic(segments, started_at)
    return summarize_heuristic(segments, started_at, ai.summary_style, ai.extract_action_items)


def _normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def apply_summary(db: Session, meeting: Meeting, draft: SummaryDraft) -> None:
    """Replace the summary and outline; add action items without touching existing ones.

    Action items are user data (they can be edited and completed), so regenerating
    only appends suggestions that aren't already present.
    """
    summary = meeting.summary
    if summary is None:
        summary = Summary(meeting_id=meeting.id)
        db.add(summary)
        meeting.summary = summary
    summary.overview = draft.overview
    summary.keywords = draft.keywords
    summary.generated_by = draft.generated_by
    summary.generated_at = utcnow()

    meeting.chapters.clear()
    db.flush()
    meeting.chapters.extend(
        Chapter(meeting_id=meeting.id, seq=i, title=c.title, start_ms=c.start_ms, summary=c.summary)
        for i, c in enumerate(draft.chapters)
    )

    existing = {_normalize(a.text) for a in meeting.action_items}
    for item in draft.action_items:
        key = _normalize(item.text)
        if key in existing:
            continue
        existing.add(key)
        meeting.action_items.append(ActionItem(
            meeting_id=meeting.id, text=item.text, source_segment_id=item.segment_id,
            assignee_participant_id=item.assignee_participant_id, due_date=item.due_date,
        ))
    db.flush()


def regenerate_summary(
    db: Session, meeting: Meeting, llm: LLMClient | None, ai: AISettings | None = None, language: str = "en",
    focus: str = "",
) -> None:
    segments = load_segments(db, meeting.id)
    draft = generate_summary(segments, meeting.started_at, llm, ai, language, focus)
    apply_summary(db, meeting, draft)
