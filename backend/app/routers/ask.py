from fastapi import APIRouter

from app.deps import CurrentUser, DbSession, Llm
from app.schemas.ask import AskIn, AskOut, SuggestionsOut
from app.schemas.common import ERROR_RESPONSES
from app.services import ask_service, suggestion_service

router = APIRouter(tags=["ask"])


@router.post("/api/meetings/{meeting_id}/ask", response_model=AskOut, responses=ERROR_RESPONSES)
def ask_about_meeting(meeting_id: int, body: AskIn, db: DbSession, user: CurrentUser, llm: Llm):
    """Ask Fred about one meeting. Uses the LLM when configured, otherwise answers from the meeting's data."""
    return ask_service.ask(db, user, body, llm, meeting_id)


@router.post("/api/ask", response_model=AskOut, responses=ERROR_RESPONSES)
def ask_across_meetings(body: AskIn, db: DbSession, user: CurrentUser, llm: Llm):
    """Ask Fred about everything in your library."""
    return ask_service.ask(db, user, body, llm, None)


@router.get("/api/meetings/{meeting_id}/suggestions", response_model=SuggestionsOut, responses=ERROR_RESPONSES)
def meeting_suggestions(meeting_id: int, db: DbSession, user: CurrentUser, llm: Llm):
    """Three questions worth asking about this meeting (written by the model when one is configured)."""
    return SuggestionsOut(questions=suggestion_service.suggest(db, user, meeting_id, llm))
