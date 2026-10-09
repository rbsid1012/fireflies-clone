from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.people import ORM


class SoundbiteOut(ORM):
    id: int
    meeting_id: int
    start_segment_id: int
    end_segment_id: int
    start_ms: int
    end_ms: int
    speaker_name: str | None
    text: str
    note: str
    created_at: datetime


class SoundbiteListOut(BaseModel):
    items: list[SoundbiteOut]


def _clean(v: str) -> str:
    return " ".join(v.split())


class SoundbiteCreate(BaseModel):
    start_segment_id: int
    end_segment_id: int | None = Field(default=None, description="Defaults to the start line: a one-line soundbite")
    note: str = Field(default="", max_length=500)

    _clean = field_validator("note")(_clean)


class SoundbiteUpdate(BaseModel):
    note: str = Field(max_length=500)

    _clean = field_validator("note")(_clean)
