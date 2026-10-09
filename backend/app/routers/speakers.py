from fastapi import APIRouter

from app.deps import CurrentUser, DbSession, Llm
from app.schemas.common import ERROR_RESPONSES
from app.schemas.meeting import MeetingDetail
from app.services import speaker_service

router = APIRouter(prefix="/api/meetings/{meeting_id}/speakers", tags=["speakers"])


@router.post("/identify", response_model=MeetingDetail, responses=ERROR_RESPONSES)
def identify_speakers(meeting_id: int, db: DbSession, user: CurrentUser, llm: Llm):
    """Re-label every transcript line with who said it, by reading the conversation. Needs an AI model."""
    return speaker_service.identify(db, user, meeting_id, llm)
