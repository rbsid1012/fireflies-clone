"""Create, read, update and delete meetings."""
import logging
import os
import re
from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.errors import AppError, NotFoundError, ValidationFailed
from app.models import (
    ActionItem, Meeting, MeetingParticipant, MeetingSource, MeetingStatus, Person, Tag,
    TranscriptSegment, User,
)
from app.schemas.meeting import MeetingUpdate, ParticipantUpdate
from app.services import media_service
from app.services.llm_client import LLMClient
from app.services.summary_service import apply_summary, generate_summary, load_segments, regenerate_summary
from app.services.settings_service import get_settings
from app.services.timing import TAIL_MS
from app.services.transcript_parser import TranscriptParseError, parse_transcript

log = logging.getLogger(__name__)

_GENERIC_SPEAKER = re.compile(r"^(speaker|participant|unknown|guest)\s*\d*$", re.I)
_TAG_COLORS = ["blue", "green", "orange", "purple", "pink", "teal", "red", "amber", "indigo", "cyan"]


# ---------------------------------------------------------------- reading

def require_meeting(db: Session, owner: User, meeting_id: int) -> Meeting:
    """The bare meeting row (no children loaded), or 404."""
    meeting = db.scalar(select(Meeting).where(Meeting.id == meeting_id, Meeting.owner_id == owner.id))
    if meeting is None:
        raise NotFoundError("Meeting")
    return meeting


def get_meeting(db: Session, owner: User, meeting_id: int) -> Meeting:
    """Load a meeting with everything the detail view shows."""
    meeting = db.scalar(
        select(Meeting)
        .where(Meeting.id == meeting_id, Meeting.owner_id == owner.id)
        .options(
            selectinload(Meeting.participants).selectinload(MeetingParticipant.person),
            selectinload(Meeting.tags),
            selectinload(Meeting.summary),
            selectinload(Meeting.chapters),
            selectinload(Meeting.action_items).selectinload(ActionItem.assignee).selectinload(MeetingParticipant.person),
            selectinload(Meeting.action_items).selectinload(ActionItem.source_segment),
        )
        .execution_options(populate_existing=True)
    )
    if meeting is None:
        raise NotFoundError("Meeting")
    return meeting


# ---------------------------------------------------------------- people & tags

def _find_person(db: Session, owner: User, name: str | None, email: str | None) -> Person | None:
    mine = Person.owner_id == owner.id
    if email:
        return db.scalar(select(Person).where(mine, func.lower(Person.email) == email.lower()))
    if name:
        # Prefer the person we know an email for, so "Alice" keeps resolving to the same Alice
        return db.scalar(
            select(Person).where(mine, func.lower(Person.name) == name.lower())
            .order_by(Person.email.is_(None), Person.id).limit(1)
        )
    return None


def resolve_person(db: Session, owner: User, name: str, email: str | None = None) -> Person:
    """Reuse one of the owner's people (by email, else by name) or create one. People are per account.

    'Speaker 2'-style labels are never shared: they don't identify anyone, and
    merging every 'Speaker 1' across meetings would corrupt the people list.
    """
    if not email and _GENERIC_SPEAKER.match(name):
        person = None
    else:
        person = _find_person(db, owner, name, email)
        if person is None and email:
            # Someone already known by this name but without an address: this adds the address
            # to that person (across all their meetings) instead of creating a duplicate.
            person = db.scalar(
                select(Person).where(Person.owner_id == owner.id, func.lower(Person.name) == name.lower(), Person.email.is_(None))
                .order_by(Person.id).limit(1)
            )
            if person is not None:
                person.email = email.lower()
    if person is None:
        person = Person(owner_id=owner.id, name=name, email=email.lower() if email else None)
        db.add(person)
        db.flush()
    return person


def _set_tags(db: Session, owner: User, meeting: Meeting, names: list[str]) -> None:
    wanted: dict[str, str] = {}
    for raw in names:
        name = " ".join(raw.split())
        if not name or len(name) > 60:
            raise ValidationFailed("Tags must be 1-60 characters.")
        wanted.setdefault(name.lower(), name)
    tags = []
    for key, name in wanted.items():
        tag = db.scalar(select(Tag).where(Tag.owner_id == owner.id, func.lower(Tag.name) == key))
        if tag is None:
            count = db.scalar(select(func.count()).select_from(Tag).where(Tag.owner_id == owner.id)) or 0
            tag = Tag(owner_id=owner.id, name=name, color=_TAG_COLORS[count % len(_TAG_COLORS)])
            db.add(tag)
            db.flush()
        tags.append(tag)
    meeting.tags = tags


def create_tag(db: Session, owner: User, raw_name: str) -> Tag:
    """A channel: a named tag that exists before any meeting uses it."""
    name = " ".join(raw_name.split())
    if not name or len(name) > 60:
        raise ValidationFailed("A channel name must be 1-60 characters.")
    if db.scalar(select(Tag).where(Tag.owner_id == owner.id, func.lower(Tag.name) == name.lower())):
        raise AppError(409, "tag_exists", f"You already have a channel called \"{name}\".")
    count = db.scalar(select(func.count()).select_from(Tag).where(Tag.owner_id == owner.id)) or 0
    tag = Tag(owner_id=owner.id, name=name, color=_TAG_COLORS[count % len(_TAG_COLORS)])
    db.add(tag)
    db.commit()
    tag.meeting_count = 0
    return tag


# ---------------------------------------------------------------- create

def _default_title(filename: str | None) -> str:
    if filename:
        stem = os.path.splitext(os.path.basename(filename))[0].replace("_", " ").replace("-", " ").strip()
        if stem:
            return stem[:255]
    return "Untitled meeting"


def create_meeting_from_transcript(
    db: Session, owner: User, *, content: str | bytes, filename: str | None, fmt: str,
    title: str | None, started_at: datetime | None, llm: LLMClient | None,
) -> Meeting:
    """Parse -> upsert people -> participants -> segments -> summary -> ready."""
    try:
        parsed = parse_transcript(content, filename, fmt)
    except TranscriptParseError as exc:
        raise ValidationFailed(str(exc), "invalid_transcript") from exc

    last_end = max(s.end_ms for s in parsed.segments)
    meeting = Meeting(
        owner_id=owner.id,
        title=title or _default_title(filename),
        started_at=started_at or datetime.now(timezone.utc),
        duration_ms=last_end + (TAIL_MS if parsed.synthesized else 0),
        source=MeetingSource.upload if filename else MeetingSource.paste,
        status=MeetingStatus.processing,
    )
    db.add(meeting)
    db.flush()

    participants: dict[str, MeetingParticipant] = {}
    for seg in parsed.segments:  # first-appearance order drives the speaker colour
        if seg.speaker not in participants:
            person = resolve_person(db, owner, seg.speaker)
            part = MeetingParticipant(
                meeting_id=meeting.id, person_id=person.id, speaker_label=seg.speaker,
                color_index=len(participants),
            )
            # Two labels can resolve to one person (e.g. 'alice' and 'Alice'); fold them together.
            existing = next((p for p in participants.values() if p.person_id == person.id), None)
            if existing is not None:
                participants[seg.speaker] = existing
                continue
            db.add(part)
            db.flush()
            participants[seg.speaker] = part

    db.add_all(
        TranscriptSegment(
            meeting_id=meeting.id, participant_id=participants[s.speaker].id, seq=i,
            start_ms=s.start_ms, end_ms=s.end_ms, text=s.text,
        )
        for i, s in enumerate(parsed.segments)
    )
    db.flush()

    try:
        cfg = get_settings(owner)
        draft = generate_summary(load_segments(db, meeting.id), meeting.started_at, llm, cfg.ai, cfg.recording.meeting_language)
        apply_summary(db, meeting, draft)
        meeting.status = MeetingStatus.ready
    except Exception:  # keep the transcript; the user can retry via summary/regenerate
        log.exception("Summary generation failed for meeting %s", meeting.id)
        meeting.status = MeetingStatus.failed
    db.commit()
    return get_meeting(db, owner, meeting.id)


# ---------------------------------------------------------------- update / delete

def _apply_participant_update(db: Session, owner: User, meeting: Meeting, upd: ParticipantUpdate) -> None:
    part = next((p for p in meeting.participants if p.id == upd.id), None)
    if part is None:
        raise ValidationFailed(f"Participant {upd.id} is not in this meeting.", "unknown_participant")
    if upd.person_id is not None:
        person = db.get(Person, upd.person_id)
        if person is None or person.owner_id != owner.id:
            raise ValidationFailed(f"Person {upd.person_id} does not exist.", "unknown_person")
    elif upd.name:
        person = resolve_person(db, owner, " ".join(upd.name.split()), upd.email)
    else:
        raise ValidationFailed("Provide person_id, or a name for the participant.")
    clash = next((p for p in meeting.participants if p.id != part.id and p.person_id == person.id), None)
    if clash is not None:
        raise AppError(409, "participant_conflict", f"{person.name} is already a participant in this meeting.")
    part.person_id = person.id
    part.person = person


def update_meeting(db: Session, owner: User, meeting_id: int, data: MeetingUpdate) -> Meeting:
    meeting = get_meeting(db, owner, meeting_id)
    fields = data.model_fields_set
    if "title" in fields and data.title is not None:
        meeting.title = data.title
    if "started_at" in fields and data.started_at is not None:
        meeting.started_at = data.started_at
    if "tags" in fields and data.tags is not None:
        _set_tags(db, owner, meeting, data.tags)
    if "participants" in fields and data.participants is not None:
        for upd in data.participants:
            _apply_participant_update(db, owner, meeting, upd)
    db.commit()
    return get_meeting(db, owner, meeting_id)


def delete_meeting(db: Session, owner: User, meeting_id: int) -> None:
    meeting = get_meeting(db, owner, meeting_id)
    media_service.delete_media(meeting.media_path)
    db.delete(meeting)  # the database cascades to every child table (and the FTS triggers)
    db.flush()
    _remove_orphaned_people(db, owner)
    db.commit()


def _remove_orphaned_people(db: Session, owner: User) -> None:
    """People exist only because they appear in meetings; drop the ones no meeting references anymore."""
    used = select(MeetingParticipant.person_id)
    db.execute(delete(Person).where(Person.owner_id == owner.id, Person.id.not_in(used)))


def attach_media(db: Session, owner: User, meeting_id: int, rel_path: str, content_type: str) -> Meeting:
    meeting = get_meeting(db, owner, meeting_id)
    old = meeting.media_path
    meeting.media_path, meeting.media_type = rel_path, content_type
    db.commit()
    if old and old != rel_path:
        media_service.delete_media(old)
    return get_meeting(db, owner, meeting_id)


def remove_media(db: Session, owner: User, meeting_id: int) -> Meeting:
    meeting = get_meeting(db, owner, meeting_id)
    media_service.delete_media(meeting.media_path)
    meeting.media_path = meeting.media_type = None
    db.commit()
    return get_meeting(db, owner, meeting_id)


def regenerate_meeting_summary(db: Session, owner: User, meeting_id: int, llm: LLMClient | None, focus: str = "") -> Meeting:
    meeting = get_meeting(db, owner, meeting_id)
    cfg = get_settings(owner)
    regenerate_summary(db, meeting, llm, cfg.ai, cfg.recording.meeting_language, focus)
    meeting.status = MeetingStatus.ready
    db.commit()
    return get_meeting(db, owner, meeting_id)
