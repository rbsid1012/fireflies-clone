"""The numbers and bullets shown in the recap email. Same rules as the transcript filters in the app,
so the email and the meeting page agree."""
import re

from app.models import Meeting, TranscriptSegment
from app.services.notes_format import parse

_DATE = re.compile(
    r"\b(today|tomorrow|yesterday|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next (week|month|quarter)"
    r"|end of (the )?(day|week|month|quarter)|january|february|march|april|may|june|july|august|september|october|november"
    r"|december|q[1-4]|\d{1,2}(:\d{2})?\s?(am|pm)|\d{1,2}(st|nd|rd|th)\b|eod|eow)\b", re.I,
)
MAX_BULLETS, MAX_LEN = 6, 170


def count_questions(segments: list[TranscriptSegment]) -> int:
    return sum("?" in s.text for s in segments)


def count_dates(segments: list[TranscriptSegment]) -> int:
    return sum(bool(_DATE.search(s.text)) for s in segments)


def overview_bullets(meeting: Meeting) -> list[str]:
    """'Section: first point' for each section of the notes; the overview's sentences when there are no sections."""
    bullets = []
    for chapter in meeting.chapters:
        points = parse(chapter.summary)
        if points:
            bullets.append(f"{chapter.title}: {points[0].text}"[:MAX_LEN])
    if not bullets and meeting.summary and meeting.summary.overview:
        bullets = [s.strip() for s in re.split(r"(?<=[.!?])\s+", meeting.summary.overview) if s.strip()]
    return bullets[:MAX_BULLETS]
