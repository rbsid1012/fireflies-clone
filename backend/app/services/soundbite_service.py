"""Soundbites: saved spans of the transcript (one or more consecutive lines) with an optional note."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import NotFoundError, ValidationFailed
from app.models import Meeting, Soundbite, TranscriptSegment, User
from app.schemas.soundbite import SoundbiteCreate, SoundbiteOut, SoundbiteUpdate
from app.services.meeting_service import require_meeting

MAX_SPAN_LINES = 30


def _segments(db: Session, meeting_id: int, start: TranscriptSegment, end: TranscriptSegment) -> list[TranscriptSegment]:
    return list(db.scalars(
        select(TranscriptSegment)
        .where(TranscriptSegment.meeting_id == meeting_id, TranscriptSegment.seq.between(start.seq, end.seq))
        .order_by(TranscriptSegment.seq)
    ))


def _out(db: Session, sb: Soundbite) -> SoundbiteOut | None:
    """None when a line it pointed at no longer exists (e.g. the transcript was re-split)."""
    start, end = db.get(TranscriptSegment, sb.start_segment_id), db.get(TranscriptSegment, sb.end_segment_id)
    if start is None or end is None:
        return None
    lines = _segments(db, sb.meeting_id, start, end)
    return SoundbiteOut(
        id=sb.id, meeting_id=sb.meeting_id, start_segment_id=sb.start_segment_id, end_segment_id=sb.end_segment_id,
        start_ms=start.start_ms, end_ms=end.end_ms, speaker_name=start.speaker_name,
        text=" ".join(s.text for s in lines), note=sb.note, created_at=sb.created_at,
    )


def _owned(db: Session, owner: User, soundbite_id: int) -> Soundbite:
    sb = db.scalar(
        select(Soundbite).join(Meeting, Meeting.id == Soundbite.meeting_id)
        .where(Soundbite.id == soundbite_id, Meeting.owner_id == owner.id)
    )
    if sb is None:
        raise NotFoundError("Soundbite")
    return sb


def list_soundbites(db: Session, owner: User, meeting_id: int) -> list[SoundbiteOut]:
    require_meeting(db, owner, meeting_id)
    rows = db.scalars(select(Soundbite).where(Soundbite.meeting_id == meeting_id))
    out = [o for o in (_out(db, sb) for sb in rows) if o]
    return sorted(out, key=lambda o: o.start_ms)


def create_soundbite(db: Session, owner: User, meeting_id: int, data: SoundbiteCreate) -> SoundbiteOut:
    require_meeting(db, owner, meeting_id)
    start = db.get(TranscriptSegment, data.start_segment_id)
    end = db.get(TranscriptSegment, data.end_segment_id or data.start_segment_id)
    if start is None or end is None or start.meeting_id != meeting_id or end.meeting_id != meeting_id:
        raise ValidationFailed("Those lines are not part of this meeting.", "invalid_segment")
    if end.seq < start.seq:
        raise ValidationFailed("The soundbite must end after it starts.", "invalid_range")
    if end.seq - start.seq >= MAX_SPAN_LINES:
        raise ValidationFailed(f"A soundbite can span at most {MAX_SPAN_LINES} lines.", "invalid_range")
    sb = Soundbite(meeting_id=meeting_id, start_segment_id=start.id, end_segment_id=end.id, note=data.note)
    db.add(sb)
    db.commit()
    return _out(db, sb)  # type: ignore[return-value]


def update_soundbite(db: Session, owner: User, soundbite_id: int, data: SoundbiteUpdate) -> SoundbiteOut:
    sb = _owned(db, owner, soundbite_id)
    sb.note = data.note
    db.commit()
    out = _out(db, sb)
    if out is None:
        raise NotFoundError("Soundbite")
    return out


def delete_soundbite(db: Session, owner: User, soundbite_id: int) -> None:
    db.delete(_owned(db, owner, soundbite_id))
    db.commit()
