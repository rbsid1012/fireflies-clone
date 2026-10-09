from datetime import datetime

from pydantic import BaseModel


class SnippetPart(BaseModel):
    """A run of snippet text. Render `match` parts highlighted; never inject as HTML."""

    text: str
    match: bool


class SearchHit(BaseModel):
    meeting_id: int
    meeting_title: str
    meeting_started_at: datetime
    segment_id: int
    seq: int
    start_ms: int
    speaker_name: str | None
    snippet: list[SnippetPart]


class SearchOut(BaseModel):
    query: str
    total: int
    page: int
    limit: int
    hits: list[SearchHit]
