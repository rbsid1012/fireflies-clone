from typing import Annotated, Literal

from fastapi import APIRouter, Query

from app.deps import CurrentUser, DbSession
from app.schemas.action_item import ActionItemOut  # noqa: F401  (documented response family)
from app.schemas.insights import AnalyticsOut, TasksOut, TaskOut
from app.services import analytics_service, task_service

router = APIRouter(tags=["insights"])


@router.get("/api/tasks", response_model=TasksOut)
def list_tasks(
    db: DbSession, user: CurrentUser,
    status: Annotated[Literal["open", "done", "all"], Query()] = "open",
    mine: bool = False,
    meeting_id: int | None = None,
    q: Annotated[str | None, Query(max_length=200)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
):
    """Action items from every meeting. `mine` keeps the ones assigned to you."""
    items, total, counts = task_service.list_tasks(db, user, status=status, mine=mine, meeting_id=meeting_id, q=q, page=page, limit=limit)
    return TasksOut(items=[TaskOut.model_validate(i) for i in items], total=total, page=page, limit=limit, counts=counts)


@router.get("/api/analytics", response_model=AnalyticsOut)
def analytics(db: DbSession, user: CurrentUser, days: Annotated[int, Query(ge=7, le=3650)] = 90):
    """Meeting counts, durations, talk time and top topics over the last `days` days."""
    return analytics_service.compute(db, user, days)
