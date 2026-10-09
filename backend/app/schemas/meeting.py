from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import MeetingSource, MeetingStatus
from app.schemas.action_item import ActionItemOut
from app.schemas.people import ORM, ParticipantOut, TagRefOut
from app.schemas.summary import ChapterOut, SummaryOut

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
TranscriptFormat = Literal["auto", "txt", "vtt", "srt", "json"]


class MeetingListItem(ORM):
    id: int
    title: str
    started_at: datetime
    duration_ms: int
    source: MeetingSource
    status: MeetingStatus
    participants: list[ParticipantOut]
    tags: list[TagRefOut]
    action_items_total: int = 0
    action_items_open: int = 0


class MeetingDetail(ORM):
    id: int
    title: str
    started_at: datetime
    duration_ms: int
    source: MeetingSource
    # Relative to the API (`/api/media/...`) for uploaded files; absolute for external media
    media_url: str | None = Field(validation_alias="media_src")
    status: MeetingStatus
    created_at: datetime
    updated_at: datetime
    participants: list[ParticipantOut]
    tags: list[TagRefOut]
    summary: SummaryOut | None
    chapters: list[ChapterOut]
    action_items: list[ActionItemOut]


class MeetingFilters(BaseModel):
    """Query parameters for GET /api/meetings."""

    model_config = ConfigDict(populate_by_name=True)

    q: str | None = Field(default=None, max_length=200, description="Title or transcript text")
    participant_id: int | None = Field(default=None, description="A people.id")
    tag: str | None = None
    source: Literal["seed", "upload", "paste", "form"] | None = Field(default=None, description="How the meeting was added")
    from_date: date | None = Field(default=None, alias="from")
    to_date: date | None = Field(default=None, alias="to")
    sort: Literal["recent", "oldest", "title", "duration"] = "recent"
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)


class MeetingCreateIn(BaseModel):
    """Create a meeting from a pasted transcript (JSON) or an uploaded file (multipart: same fields plus `file`)."""

    title: str | None = Field(default=None, max_length=255)
    started_at: datetime | None = None
    transcript_text: str | None = Field(default=None, description="Pasted transcript; omit when uploading a file")
    format: TranscriptFormat = "auto"

    @field_validator("title")
    @classmethod
    def _title(cls, v: str | None) -> str | None:
        v = " ".join(v.split()) if v else None
        return v or None


class ParticipantUpdate(BaseModel):
    """Re-point a transcript speaker at a person: an existing `person_id`, or a `name` (+ optional email)."""

    id: int = Field(description="meeting_participants.id")
    person_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = Field(default=None, pattern=EMAIL_PATTERN, max_length=255)


class MeetingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    started_at: datetime | None = None
    tags: list[str] | None = Field(default=None, max_length=20, description="Replaces the tag set")
    participants: list[ParticipantUpdate] | None = None

    @field_validator("title")
    @classmethod
    def _title(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = " ".join(v.split())
        if not v:
            raise ValueError("title must not be blank")
        return v
