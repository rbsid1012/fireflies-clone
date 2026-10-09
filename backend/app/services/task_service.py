"""The cross-meeting Tasks list: every action item the user can see, with filters."""
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import ActionItem, Meeting, MeetingParticipant, Person, User
from app.schemas.insights import TaskCounts


def _mine_clause(user: User):
    """Items assigned to a participant who is this user (matched by email, else by name)."""
    person_ids = select(Person.id).where(
        Person.owner_id == user.id, or_(func.lower(Person.email) == user.email.lower(), func.lower(Person.name) == user.name.lower())
    )
    return ActionItem.assignee_participant_id.in_(select(MeetingParticipant.id).where(MeetingParticipant.person_id.in_(person_ids)))


def list_tasks(
    db: Session, user: User, *, status: str, mine: bool, meeting_id: int | None, q: str | None, page: int, limit: int,
) -> tuple[list[ActionItem], int, TaskCounts]:
    base = select(ActionItem).join(Meeting, Meeting.id == ActionItem.meeting_id).where(Meeting.owner_id == user.id)
    if meeting_id is not None:
        base = base.where(ActionItem.meeting_id == meeting_id)
    if mine:
        base = base.where(_mine_clause(user))
    if q and q.strip():
        escaped = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        base = base.where(ActionItem.text.ilike(f"%{escaped}%", escape="\\"))

    counted = base.with_only_columns(
        func.count().filter(ActionItem.is_completed.is_(False)),
        func.count().filter(ActionItem.is_completed.is_(True)),
        func.count().filter(ActionItem.is_completed.is_(False), ActionItem.due_date < date.today()),
    ).order_by(None)
    open_n, done_n, overdue = db.execute(counted).one()
    mine_n = db.scalar(
        select(func.count()).select_from(ActionItem).join(Meeting, Meeting.id == ActionItem.meeting_id)
        .where(Meeting.owner_id == user.id, ActionItem.is_completed.is_(False), _mine_clause(user))
    )

    shown = base
    if status == "open":
        shown = shown.where(ActionItem.is_completed.is_(False))
    elif status == "done":
        shown = shown.where(ActionItem.is_completed.is_(True))
    total = db.scalar(select(func.count()).select_from(shown.subquery())) or 0
    # Open items by soonest due date (undated last), then newest; done items by most recently completed
    order = (
        [ActionItem.completed_at.desc()] if status == "done"
        else [ActionItem.is_completed.asc(), ActionItem.due_date.is_(None), ActionItem.due_date.asc(), ActionItem.id.desc()]
    )
    items = list(db.scalars(
        shown.order_by(*order).limit(limit).offset((page - 1) * limit).options(
            selectinload(ActionItem.assignee).selectinload(MeetingParticipant.person),
            selectinload(ActionItem.source_segment),
            selectinload(ActionItem.meeting),
        )
    ))
    return items, total, TaskCounts(open=open_n or 0, done=done_n or 0, mine=mine_n or 0, overdue=overdue or 0)
