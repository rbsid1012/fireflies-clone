from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import Meeting, MeetingParticipant, TranscriptSegment, User
from app.schemas.transcript import TranscriptSearchOut
from app.services.meeting_service import require_meeting
from app.services.search_service import search_in_meeting


def get_transcript(db: Session, owner: User, meeting_id: int) -> tuple[Meeting, list[TranscriptSegment]]:
    meeting = require_meeting(db, owner, meeting_id)
    segments = list(db.scalars(
        select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id)
        .order_by(TranscriptSegment.seq)
        .options(selectinload(TranscriptSegment.participant).selectinload(MeetingParticipant.person))
    ))
    return meeting, segments


def search_transcript(db: Session, owner: User, meeting_id: int, query: str) -> TranscriptSearchOut:
    require_meeting(db, owner, meeting_id)
    return search_in_meeting(db, meeting_id, query)
