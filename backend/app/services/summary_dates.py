"""Resolve phrases like 'by Friday' or 'tomorrow' to a date, relative to when the meeting happened."""
import calendar
import re
from datetime import date, timedelta

_WEEKDAYS = {name.lower(): i for i, name in enumerate(calendar.day_name)}
_WEEKDAY_RE = re.compile(
    r"\b(?:by|before|on|until|this)\s+(?:the\s+)?(?:next\s+)?(" + "|".join(_WEEKDAYS) + r")\b", re.I
)
_TODAY_RE = re.compile(r"\b(?:by\s+)?(?:end of (?:the )?day|eod|today|tonight)\b", re.I)
_TOMORROW_RE = re.compile(r"\btomorrow\b", re.I)
_WEEK_END_RE = re.compile(r"\b(?:end of (?:the )?week|eow)\b", re.I)
_NEXT_WEEK_RE = re.compile(r"\bnext week\b", re.I)
_MONTH_END_RE = re.compile(r"\bend of (?:the )?month\b", re.I)


def parse_due_date(sentence: str, reference: date) -> date | None:
    m = _WEEKDAY_RE.search(sentence)
    if m:
        target = _WEEKDAYS[m.group(1).lower()]
        delta = (target - reference.weekday()) % 7 or 7  # the next such day, never "today"
        return reference + timedelta(days=delta)
    if _TOMORROW_RE.search(sentence):
        return reference + timedelta(days=1)
    if _WEEK_END_RE.search(sentence):
        return reference + timedelta(days=(4 - reference.weekday()) % 7)
    if _MONTH_END_RE.search(sentence):
        last = calendar.monthrange(reference.year, reference.month)[1]
        return reference.replace(day=last)
    if _NEXT_WEEK_RE.search(sentence):
        return reference + timedelta(days=7)
    if _TODAY_RE.search(sentence):
        return reference
    return None
