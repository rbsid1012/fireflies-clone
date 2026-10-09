from fastapi import APIRouter

from app.deps import CurrentUser, DbSession, Llm
from app.schemas.common import ERROR_RESPONSES
from app.schemas.meeting import MeetingDetail
from app.schemas.summary import SummaryRegenerateIn
from app.services import meeting_service
from app.services.summary_templates import focus_for

router = APIRouter(prefix="/api/meetings/{meeting_id}/summary", tags=["summary"])


@router.post("/regenerate", response_model=MeetingDetail, responses=ERROR_RESPONSES)
def regenerate_summary(meeting_id: int, db: DbSession, user: CurrentUser, llm: Llm, body: SummaryRegenerateIn | None = None):
    """Rebuild overview, keywords and outline, optionally in a template ("1:1", "Standup"...) or following your instructions.
    Existing action items are kept; new ones are appended."""
    body = body or SummaryRegenerateIn()
    return meeting_service.regenerate_meeting_summary(db, user, meeting_id, llm, focus_for(body.template, body.instructions))
