from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import CurrentUser, DbSession
from app.schemas.common import ERROR_RESPONSES
from app.schemas.transcript import TranscriptOut, TranscriptSearchOut, TranscriptSegmentOut
from app.services import transcript_service

router = APIRouter(prefix="/api/meetings/{meeting_id}/transcript", tags=["transcript"])


@router.get("", response_model=TranscriptOut, responses=ERROR_RESPONSES)
def get_transcript(meeting_id: int, db: DbSession, user: CurrentUser):
    meeting, segments = transcript_service.get_transcript(db, user, meeting_id)
    return TranscriptOut(
        meeting_id=meeting.id, duration_ms=meeting.duration_ms,
        segments=[TranscriptSegmentOut.model_validate(s) for s in segments],
    )


@router.get("/search", response_model=TranscriptSearchOut, responses=ERROR_RESPONSES)
def search_transcript(
    meeting_id: int, db: DbSession, user: CurrentUser,
    q: Annotated[str, Query(min_length=1, max_length=200)],
):
    """Segments in this meeting matching `q`, with character offsets of each match."""
    return transcript_service.search_transcript(db, user, meeting_id, q)
