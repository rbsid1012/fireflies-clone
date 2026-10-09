"""Library-wide statistics for the Analytics page, computed from the user's own meetings."""
from collections import Counter
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ActionItem, Meeting, MeetingParticipant, MeetingTag, Person, Summary, Tag, TranscriptSegment, User
from app.models.base import utcnow
from app.schemas.insights import (
    AnalyticsOut, AnalyticsTotals, KeywordCount, TagCount, TalkTime, WeekBucket,
)

WEEKS = 12


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def compute(db: Session, user: User, days: int) -> AnalyticsOut:
    since = utcnow() - timedelta(days=days)
    meetings = list(db.execute(
        select(Meeting.id, Meeting.started_at, Meeting.duration_ms).where(Meeting.owner_id == user.id, Meeting.started_at >= since)
    ))
    ids = [m.id for m in meetings]
    total_ms = sum(m.duration_ms for m in meetings)

    items_total, items_done = (0, 0)
    if ids:
        items_total, items_done = db.execute(
            select(func.count(), func.count().filter(ActionItem.is_completed.is_(True))).where(ActionItem.meeting_id.in_(ids))
        ).one()

    talk_rows = db.execute(
        select(Person.id, Person.name, func.sum(TranscriptSegment.end_ms - TranscriptSegment.start_ms))
        .join(MeetingParticipant, MeetingParticipant.person_id == Person.id)
        .join(TranscriptSegment, TranscriptSegment.participant_id == MeetingParticipant.id)
        .where(TranscriptSegment.meeting_id.in_(ids or [-1]))
        .group_by(Person.id).order_by(func.sum(TranscriptSegment.end_ms - TranscriptSegment.start_ms).desc())
    ).all()
    spoken = sum(r[2] or 0 for r in talk_rows) or 1
    talk = [TalkTime(person_id=r[0], name=r[1], ms=int(r[2] or 0), share=(r[2] or 0) / spoken) for r in talk_rows[:10]]

    keywords: Counter[str] = Counter()
    for (kw_list,) in db.execute(select(Summary.keywords).where(Summary.meeting_id.in_(ids or [-1]))):
        keywords.update(k.lower() for k in kw_list or [])

    tag_rows = db.execute(
        select(Tag.name, Tag.color, func.count()).join(MeetingTag, MeetingTag.tag_id == Tag.id)
        .where(MeetingTag.meeting_id.in_(ids or [-1])).group_by(Tag.id).order_by(func.count().desc(), Tag.name).limit(8)
    ).all()

    this_week = _monday(datetime.now(timezone.utc).date())
    buckets = {this_week - timedelta(weeks=i): [0, 0] for i in range(WEEKS)}
    for m in meetings:
        key = _monday(m.started_at.date())
        if key in buckets:
            buckets[key][0] += 1
            buckets[key][1] += m.duration_ms

    return AnalyticsOut(
        days=days,
        totals=AnalyticsTotals(
            meetings=len(meetings), total_duration_ms=total_ms, avg_duration_ms=total_ms // len(meetings) if meetings else 0,
            action_items_total=items_total, action_items_done=items_done,
            completion_rate=(items_done / items_total) if items_total else 0.0, people=len(talk_rows),
        ),
        weekly=[WeekBucket(week_start=k, meetings=v[0], duration_ms=v[1]) for k, v in sorted(buckets.items())],
        talk_time=talk,
        keywords=[KeywordCount(keyword=k, count=c) for k, c in keywords.most_common(15)],
        tags=[TagCount(name=n, color=c, count=k) for n, c, k in tag_rows],
    )
