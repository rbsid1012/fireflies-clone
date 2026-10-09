from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.action_item import ActionItemOut


class TaskOut(ActionItemOut):
    """An action item plus the meeting it came from, for the cross-meeting Tasks list."""

    meeting_title: str
    meeting_started_at: datetime


class TaskCounts(BaseModel):
    open: int
    done: int
    mine: int
    overdue: int


class TasksOut(BaseModel):
    items: list[TaskOut]
    total: int
    page: int
    limit: int
    counts: TaskCounts


class AnalyticsTotals(BaseModel):
    meetings: int
    total_duration_ms: int
    avg_duration_ms: int
    action_items_total: int
    action_items_done: int
    completion_rate: float  # 0..1
    people: int


class WeekBucket(BaseModel):
    week_start: date
    meetings: int
    duration_ms: int


class TalkTime(BaseModel):
    person_id: int
    name: str
    ms: int
    share: float  # 0..1 of all speaking time in the period


class KeywordCount(BaseModel):
    keyword: str
    count: int


class TagCount(BaseModel):
    name: str
    color: str
    count: int


class AnalyticsOut(BaseModel):
    days: int
    totals: AnalyticsTotals
    weekly: list[WeekBucket]
    talk_time: list[TalkTime]
    keywords: list[KeywordCount]
    tags: list[TagCount]
