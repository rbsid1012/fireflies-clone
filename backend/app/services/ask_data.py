"""Loading the material Ask Fred answers from, for one meeting or all of a user's meetings."""
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import ActionItem, Meeting, MeetingParticipant, TranscriptSegment, User
from app.schemas.ask import AskSource
from app.services.meeting_service import get_meeting

MAX_SEGMENTS_SCANNED = 20_000


def load_meetings(db: Session, owner: User, meeting_id: int | None) -> list[Meeting]:
    """One meeting (404 if it isn't yours) or all of them, newest first, fully loaded."""
    if meeting_id is not None:
        return [get_meeting(db, owner, meeting_id)]
    ids = db.scalars(select(Meeting.id).where(Meeting.owner_id == owner.id).order_by(Meeting.started_at.desc())).all()
    return [get_meeting(db, owner, i) for i in ids]


def load_segments(db: Session, meetings: list[Meeting]) -> list[TranscriptSegment]:
    if not meetings:
        return []
    return list(db.scalars(
        select(TranscriptSegment)
        .where(TranscriptSegment.meeting_id.in_([m.id for m in meetings]))
        .order_by(TranscriptSegment.meeting_id, TranscriptSegment.seq)
        .limit(MAX_SEGMENTS_SCANNED)
        .options(selectinload(TranscriptSegment.participant).selectinload(MeetingParticipant.person))
    ))


def source_for(segment: TranscriptSegment, titles: dict[int, str]) -> AskSource:
    return AskSource(
        meeting_id=segment.meeting_id, meeting_title=titles.get(segment.meeting_id, ""), segment_id=segment.id,
        start_ms=segment.start_ms, speaker_name=segment.speaker_name, text=segment.text,
    )


def action_item_source(item: ActionItem, titles: dict[int, str]) -> AskSource:
    return AskSource(
        meeting_id=item.meeting_id, meeting_title=titles.get(item.meeting_id, ""), segment_id=item.source_segment_id,
        start_ms=item.source_start_ms or 0, speaker_name=item.assignee.name if item.assignee else None, text=item.text,
    )
