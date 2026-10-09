"""Listing meetings with filters, sorting and pagination."""
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models import ActionItem, Meeting, MeetingParticipant, MeetingTag, Tag, User
from app.schemas.meeting import MeetingFilters
from app.services.search_service import build_fts_query, meeting_id_match_clause

_SORTS = {
    "recent": (Meeting.started_at.desc(),),
    "oldest": (Meeting.started_at.asc(),),
    "title": (func.lower(Meeting.title).asc(),),
    "duration": (Meeting.duration_ms.desc(),),
}


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _conditions(owner: User, f: MeetingFilters) -> list:
    conds = [Meeting.owner_id == owner.id]
    if f.q and f.q.strip():
        match = Meeting.title.ilike(f"%{_escape_like(f.q.strip())}%", escape="\\")
        fts = build_fts_query(f.q)
        conds.append(or_(match, meeting_id_match_clause(fts)) if fts else match)
    if f.participant_id is not None:
        conds.append(Meeting.id.in_(
            select(MeetingParticipant.meeting_id).where(MeetingParticipant.person_id == f.participant_id)
        ))
    if f.tag:
        conds.append(Meeting.id.in_(
            select(MeetingTag.meeting_id).join(Tag, Tag.id == MeetingTag.tag_id)
            .where(func.lower(Tag.name) == f.tag.strip().lower())
        ))
    if f.source:
        conds.append(Meeting.source == f.source)
    if f.from_date:
        conds.append(Meeting.started_at >= datetime.combine(f.from_date, time.min, timezone.utc))
    if f.to_date:  # inclusive of the whole end day
        conds.append(Meeting.started_at < datetime.combine(f.to_date + timedelta(days=1), time.min, timezone.utc))
    return conds


def list_meetings(db: Session, owner: User, f: MeetingFilters) -> tuple[list[Meeting], int]:
    conds = _conditions(owner, f)
    total = db.scalar(select(func.count()).select_from(Meeting).where(*conds)) or 0
    meetings = list(db.scalars(
        select(Meeting).where(*conds)
        .order_by(*_SORTS[f.sort], Meeting.id.desc())
        .limit(f.limit).offset((f.page - 1) * f.limit)
        .options(selectinload(Meeting.participants).selectinload(MeetingParticipant.person),
                 selectinload(Meeting.tags))
    ))
    counts = {
        mid: (n, open_n or 0)
        for mid, n, open_n in db.execute(
            select(ActionItem.meeting_id, func.count(),
                   func.sum(case((ActionItem.is_completed.is_(False), 1), else_=0)))
            .where(ActionItem.meeting_id.in_([m.id for m in meetings]))
            .group_by(ActionItem.meeting_id)
        )
    }
    for m in meetings:  # read by MeetingListItem via from_attributes
        m.action_items_total, m.action_items_open = counts.get(m.id, (0, 0))
    return meetings, total
