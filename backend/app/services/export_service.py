"""Render a meeting as Markdown or plain text."""
from typing import Literal

from sqlalchemy.orm import Session

from app.models import Meeting, User
from app.services.formatting import format_duration, format_timestamp, slugify
from app.services.notes_format import plain
from app.services.meeting_service import get_meeting
from app.services.transcript_service import get_transcript

ExportFormat = Literal["md", "txt"]
MEDIA_TYPES = {"md": "text/markdown; charset=utf-8", "txt": "text/plain; charset=utf-8"}


def _action_line(item, md: bool) -> str:
    who = f" ({item.assignee.name})" if item.assignee else ""
    due = f" - due {item.due_date.isoformat()}" if item.due_date else ""
    box = ("[x]" if item.is_completed else "[ ]") if md else ("[done]" if item.is_completed else "[todo]")
    return f"{'- ' if md else ''}{box} {item.text}{who}{due}"


def render_meeting(meeting: Meeting, segments: list, fmt: ExportFormat) -> str:
    md = fmt == "md"
    h1 = (lambda t: f"# {t}") if md else (lambda t: f"{t}\n{'=' * len(t)}")
    h2 = (lambda t: f"## {t}") if md else (lambda t: f"{t}\n{'-' * len(t)}")
    bullet = "- " if md else "  "

    lines = [h1(meeting.title), ""]
    people = ", ".join(p.name for p in meeting.participants)
    lines.append(f"{meeting.started_at:%Y-%m-%d %H:%M} UTC | {format_duration(meeting.duration_ms)}")
    if people:
        lines.append(f"Participants: {people}")
    if meeting.tags:
        lines.append("Tags: " + ", ".join(t.name for t in meeting.tags))
    lines.append("")

    if meeting.summary and meeting.summary.overview:
        lines += [h2("Overview"), meeting.summary.overview]
        if meeting.summary.keywords:
            lines += ["", "Keywords: " + ", ".join(meeting.summary.keywords)]
        lines.append("")
    if meeting.chapters:
        lines.append(h2("Outline"))
        for ch in meeting.chapters:
            tail = f" - {plain(ch.summary)}" if ch.summary else ""
            lines.append(f"{bullet}[{format_timestamp(ch.start_ms)}] {ch.title}{tail}")
        lines.append("")
    if meeting.action_items:
        lines.append(h2("Action items"))
        lines += [_action_line(i, md) if md else f"{bullet}{_action_line(i, md)}" for i in meeting.action_items]
        lines.append("")

    lines.append(h2("Transcript"))
    for seg in segments:
        speaker = seg.speaker_name or "Unknown"
        stamp = f"[{format_timestamp(seg.start_ms)}]"
        lines.append(f"**{stamp} {speaker}:** {seg.text}" if md else f"{stamp} {speaker}: {seg.text}")
        if md:
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def export_meeting(db: Session, owner: User, meeting_id: int, fmt: ExportFormat) -> tuple[str, str, str]:
    """Return (filename, body, media_type)."""
    meeting = get_meeting(db, owner, meeting_id)
    _, segments = get_transcript(db, owner, meeting_id)
    return f"{slugify(meeting.title)}.{fmt}", render_meeting(meeting, segments, fmt), MEDIA_TYPES[fmt]
