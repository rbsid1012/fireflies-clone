"""Read and validate the seed meeting JSON files.

Validation lives here so a typo in a data file (unknown speaker, out-of-range
segment index) fails loudly at load time instead of seeding a broken meeting.
"""
import json
from datetime import date, datetime
from pathlib import Path

from pydantic import BaseModel, model_validator

DATA_DIR = Path(__file__).parent / "data"


class SeedParticipant(BaseModel):
    label: str  # how the speaker appears in the transcript
    name: str
    email: str


class SeedChapter(BaseModel):
    at: int  # segment index the chapter starts at
    title: str
    summary: str | None = None


class SeedActionItem(BaseModel):
    at: int  # segment index where it was said
    text: str
    assignee: str | None = None  # participant label
    due: date | None = None
    done: bool = False


class SeedSoundbite(BaseModel):
    from_seq: int
    to_seq: int
    note: str

    model_config = {"populate_by_name": True}

    @model_validator(mode="before")
    @classmethod
    def _rename(cls, data):
        if isinstance(data, dict) and "from" in data:
            data = {**data, "from_seq": data["from"], "to_seq": data["to"]}
        return data


class SeedMeeting(BaseModel):
    title: str
    started_at: datetime
    tags: list[str] = []
    participants: list[SeedParticipant]
    segments: list[tuple[str, str]]  # (speaker label, text)
    overview: str
    keywords: list[str]
    chapters: list[SeedChapter]
    action_items: list[SeedActionItem]
    soundbites: list[SeedSoundbite] = []
    source_file: str | None = None  # the data file's name without extension; also names its recording

    @model_validator(mode="after")
    def _cross_references(self):
        labels = {p.label for p in self.participants}
        n = len(self.segments)
        if len(labels) != len(self.participants):
            raise ValueError("duplicate participant labels")
        for speaker, _ in self.segments:
            if speaker not in labels:
                raise ValueError(f"segment speaker {speaker!r} is not a participant")
        for item in self.action_items:
            if item.assignee is not None and item.assignee not in labels:
                raise ValueError(f"action item assignee {item.assignee!r} is not a participant")
            if not 0 <= item.at < n:
                raise ValueError(f"action item index {item.at} out of range (0..{n - 1})")
        for ch in self.chapters:
            if not 0 <= ch.at < n:
                raise ValueError(f"chapter index {ch.at} out of range (0..{n - 1})")
        if [c.at for c in self.chapters] != sorted(c.at for c in self.chapters):
            raise ValueError("chapters must be in ascending order")
        for sb in self.soundbites:
            if not (0 <= sb.from_seq <= sb.to_seq < n):
                raise ValueError(f"soundbite range {sb.from_seq}..{sb.to_seq} invalid")
        return self


def load_seed_meetings(data_dir: Path = DATA_DIR) -> list[SeedMeeting]:
    meetings = []
    for path in sorted(data_dir.glob("*.json")):
        try:
            meetings.append(SeedMeeting.model_validate({**json.loads(path.read_text()), "source_file": path.stem}))
        except Exception as exc:
            raise ValueError(f"Invalid seed file {path.name}: {exc}") from exc
    return meetings
