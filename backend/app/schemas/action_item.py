from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.people import ORM, ParticipantOut


class ActionItemOut(ORM):
    id: int
    meeting_id: int
    text: str
    assignee_participant_id: int | None
    assignee: ParticipantOut | None
    source_segment_id: int | None
    source_start_ms: int | None
    due_date: date | None
    is_completed: bool
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


def _clean_text(v: str) -> str:
    v = " ".join(v.split())
    if not v:
        raise ValueError("text must not be blank")
    return v


class ActionItemCreate(BaseModel):
    text: str = Field(max_length=1000)
    assignee_participant_id: int | None = None
    due_date: date | None = None
    source_segment_id: int | None = None

    _clean = field_validator("text")(_clean_text)


class ActionItemUpdate(BaseModel):
    """PATCH body. Omitted fields are left alone; an explicit null clears assignee/due date."""

    text: str | None = Field(default=None, max_length=1000)
    assignee_participant_id: int | None = None
    due_date: date | None = None
    is_completed: bool | None = None

    @field_validator("text")
    @classmethod
    def _text(cls, v: str | None) -> str | None:
        return None if v is None else _clean_text(v)
