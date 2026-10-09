from datetime import datetime

from pydantic import BaseModel, Field

from app.models import SummarySource
from app.schemas.people import ORM
from app.services.summary_templates import Template


class SummaryOut(ORM):
    overview: str
    keywords: list[str]
    generated_by: SummarySource
    generated_at: datetime


class ChapterOut(ORM):
    id: int
    seq: int
    title: str
    start_ms: int
    summary: str | None


class SummaryRegenerateIn(BaseModel):
    """Optional: pick a summary style and/or say what to focus on. Empty means the general summary."""

    template: Template = "general"
    instructions: str | None = Field(default=None, max_length=1000)
