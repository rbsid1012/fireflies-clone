from pydantic import BaseModel

from app.schemas.people import ORM


class TranscriptSegmentOut(ORM):
    id: int
    seq: int
    start_ms: int
    end_ms: int
    text: str
    participant_id: int | None
    speaker_label: str | None
    speaker_name: str | None
    color_index: int


class TranscriptOut(BaseModel):
    meeting_id: int
    duration_ms: int
    segments: list[TranscriptSegmentOut]


class MatchSpan(BaseModel):
    """Character offsets into the segment's `text` (end exclusive)."""

    start: int
    end: int


class SegmentMatch(BaseModel):
    segment_id: int
    seq: int
    start_ms: int
    matches: list[MatchSpan]


class TranscriptSearchOut(BaseModel):
    query: str
    total_matches: int
    segments: list[SegmentMatch]
