"""Summarize a transcript with no LLM: time-window chapters, TF-IDF keywords, pattern-based action items."""
import re
from datetime import datetime

from app.models import SummarySource
from app.services.notes_format import Point, encode
from app.services.summary_dates import parse_due_date
from app.services.summary_types import (
    ActionItemDraft, ChapterDraft, SegmentInfo, SummaryDraft,
)
from app.services.text_stats import tokenize, top_terms

MIN_WINDOW_MS, MAX_WINDOW_MS, TARGET_CHAPTERS = 60_000, 600_000, 6
MAX_OVERVIEW_CHAPTERS, MAX_ACTION_ITEMS = 5, 10
# How many sentences the overview may use, by the user's chosen summary style
OVERVIEW_SENTENCES = {"concise": 3, "balanced": MAX_OVERVIEW_CHAPTERS, "detailed": 8}

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_FIRST_PERSON = r"\bI(?:'ll| will|'m going to| am going to| can take)\b"
_ACTION_PATTERNS = [
    re.compile(_FIRST_PERSON, re.I),
    re.compile(r"\bwe (?:need|have|should|must) to\b", re.I),
    re.compile(r"\b(?:can|could) you(?!\s+(?:tell|walk|explain|describe|talk|share|say|give))\b", re.I),
    re.compile(r"\bby (?:the end of|end of|eod|eow|tomorrow|next week|monday|tuesday|wednesday|thursday|friday)\b", re.I),
    re.compile(r"\baction items?\b", re.I),
    re.compile(r"\b(?:make sure|follow(?:ing)? up|let's (?:schedule|set up))\b", re.I),
]
_FIRST_PERSON_RE = re.compile(_FIRST_PERSON, re.I)
_CAN_YOU_RE = re.compile(r"\b(?:can|could) you\b", re.I)


def sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENTENCE_SPLIT.split(text) if s.strip()]


def _word_count(s: str) -> int:
    return len(s.split())


def _windows(segments: list[SegmentInfo]) -> list[list[SegmentInfo]]:
    """Group segments into fixed-length time windows; a window with <2 segments joins the previous one."""
    duration = segments[-1].end_ms
    size = min(MAX_WINDOW_MS, max(MIN_WINDOW_MS, duration // TARGET_CHAPTERS))
    groups: dict[int, list[SegmentInfo]] = {}
    for seg in segments:
        groups.setdefault(seg.start_ms // size, []).append(seg)
    merged: list[list[SegmentInfo]] = []
    for key in sorted(groups):
        if merged and len(groups[key]) < 2:
            merged[-1].extend(groups[key])
        else:
            merged.append(groups[key])
    if len(merged) > 1 and len(merged[0]) < 2:
        merged[1] = merged[0] + merged[1]
        merged.pop(0)
    return merged


def _best_sentence(window: list[SegmentInfo]) -> str | None:
    candidates = [s for seg in window for s in sentences(seg.text)]
    for s in candidates:
        if _word_count(s) >= 7 and not s.endswith("?"):
            return s
    return candidates[0] if candidates else None


_HAS_FIGURE = re.compile(r"\d|\b(?:monday|tuesday|wednesday|thursday|friday|january|february|march|april|may|june|july|august|september|october|november|december|tomorrow|percent)\b", re.I)
POINTS_PER_CHAPTER = {"concise": 2, "balanced": 3, "detailed": 5}


def _chapter_points(window: list[SegmentInfo], limit: int) -> list[Point]:
    """The most informative sentences of a window, figures and dates first, each linked to the line it was said on."""
    scored = []
    for order, seg in enumerate(window):
        for sentence in sentences(seg.text):
            words = _word_count(sentence)
            if words < 6 or words > 40 or sentence.endswith("?"):
                continue
            scored.append((2 * bool(_HAS_FIGURE.search(sentence)) + min(words, 25) / 25, order, seg.start_ms, sentence))
    best = sorted(scored, key=lambda x: -x[0])[:limit]
    return [Point(sentence[:240], ms) for _, _, ms, sentence in sorted(best, key=lambda x: (x[1], x[2]))]


def _chapter_title(terms: list[str]) -> str:
    return ", ".join(t.capitalize() for t in terms) if terms else "Discussion"


def _action_items(segments: list[SegmentInfo], started_on) -> list[ActionItemDraft]:
    drafts: list[ActionItemDraft] = []
    seen: set[str] = set()
    for idx, seg in enumerate(segments):
        for sentence in sentences(seg.text):
            if not 5 <= _word_count(sentence) <= 45:
                continue
            if not any(p.search(sentence) for p in _ACTION_PATTERNS):
                continue
            if sentence.endswith("?") and not _CAN_YOU_RE.search(sentence):
                continue  # "Do we need to...?" is a question, not a commitment
            key = re.sub(r"[^a-z0-9]", "", sentence.lower())
            if key in seen:
                continue
            seen.add(key)
            assignee = None
            if _FIRST_PERSON_RE.search(sentence):
                assignee = seg.participant_id
            elif _CAN_YOU_RE.search(sentence) and idx + 1 < len(segments):
                nxt = segments[idx + 1]
                if nxt.participant_id != seg.participant_id:
                    assignee = nxt.participant_id  # the person being asked usually answers next
            drafts.append(ActionItemDraft(
                text=sentence[:240], segment_id=seg.segment_id, assignee_participant_id=assignee,
                due_date=parse_due_date(sentence, started_on),
            ))
            if len(drafts) >= MAX_ACTION_ITEMS:
                return drafts
    return drafts


def summarize_heuristic(
    segments: list[SegmentInfo], started_at: datetime, style: str = "balanced", extract_action_items: bool = True,
) -> SummaryDraft:
    if not segments:
        return SummaryDraft(overview="", keywords=[], chapters=[], generated_by=SummarySource.heuristic)

    speaker_words = {w.lower() for seg in segments if seg.speaker for w in seg.speaker.split()}
    windows = _windows(segments)
    docs = [tokenize(" ".join(seg.text for seg in w)) for w in windows]

    chapters = [
        ChapterDraft(
            title=_chapter_title(top_terms(docs, doc, k=3, exclude=speaker_words)),
            start_ms=w[0].start_ms,
            summary=encode(_chapter_points(w, POINTS_PER_CHAPTER.get(style, 3))) or (_best_sentence(w) or "")[:240] or None,
        )
        for w, doc in zip(windows, docs)
    ]
    summaries = [t for w in windows if (t := _best_sentence(w))]
    limit = OVERVIEW_SENTENCES.get(style, MAX_OVERVIEW_CHAPTERS)
    if len(summaries) > limit:  # sample evenly so the overview spans the meeting
        step = len(summaries) / limit
        summaries = [summaries[int(i * step)] for i in range(limit)]

    return SummaryDraft(
        overview=" ".join(summaries),
        keywords=top_terms(docs, k=8, exclude=speaker_words),
        chapters=chapters,
        action_items=_action_items(segments, started_at.date()) if extract_action_items else [],
        generated_by=SummarySource.heuristic,
    )
