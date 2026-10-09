"""Summarize with the configured model. Any failure raises LLMError so the caller can fall back to the heuristic."""
import json
import re
from datetime import date, datetime

from app.models import SummarySource
from app.schemas.settings import LANGUAGES, AISettings
from app.services.llm_client import LLMClient, LLMError
from app.services.notes_format import Point, encode
from app.services.summary_types import (
    ActionItemDraft, ChapterDraft, SegmentInfo, SummaryDraft,
)

MAX_TRANSCRIPT_CHARS = 400_000

SYSTEM_PROMPT = """You summarize meeting transcripts. Reply with a single JSON object and nothing else:
{
  "overview": "3-6 sentence summary of what was discussed and decided",
  "keywords": ["up to 8 short topical keywords"],
  "chapters": [{"title": "section heading", "start_seq": 0, "points": [{"text": "one specific point", "seq": 0, "details": ["supporting fact"]}]}],
  "action_items": [{"text": "imperative task", "seq": 0, "assignee": "speaker name or null", "due": "YYYY-MM-DD or null"}]
}
Rules: `seq` and `start_seq` are the [number] at the start of a transcript line; a point's `seq` is the line it comes from.
Chapters are in order, 3-8 of them, the first at the start of the meeting. Each chapter has 2-5 points. Put the figures, reasons, conditions and
consequences behind a point in its `details` (1-3 short ones); most points should have at least one, and a detail must add something the point does not already say. Write notes like a careful human note-taker: terse noun phrases, not chatty
sentences, and always keep the specifics that were said: numbers, percentages, amounts, dates and deadlines, versions,
names, owners, counts and decisions ("Beta launch delayed to October 23rd", "Crash rate 0.4%", "Fix expected by Wednesday").
Never replace a figure or date with a vague word, and never invent one. Only list action items someone explicitly
committed to or was asked to do. Use only information present in the transcript."""


def _format_transcript(segments: list[SegmentInfo]) -> str:
    return "\n".join(f"[{s.seq}] {s.speaker or 'Speaker'}: {s.text}" for s in segments)


def _extract_json(raw: str) -> dict:
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
    start, end = raw.find("{"), raw.rfind("}")
    if start < 0 or end < start:
        raise LLMError("The model did not return JSON.")
    try:
        data = json.loads(raw[start:end + 1])
    except json.JSONDecodeError as exc:
        raise LLMError("The model returned malformed JSON.") from exc
    if not isinstance(data, dict):
        raise LLMError("The model returned an unexpected structure.")
    return data


def _parse_due(value: object) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


_STYLE_HINT = {
    "concise": "Keep the overview to 2-3 sentences, use 3-4 chapters and 1-2 points per chapter with no details.",
    "balanced": "",
    "detailed": "Write a thorough overview of 6-9 sentences, use up to 8 chapters and up to 5 points per chapter with details.",
}


def _system_prompt(ai: AISettings | None, language: str = "en", focus: str = "") -> str:
    lang_hint = [] if language == "en" else [f"Write the summary, titles and action items in {LANGUAGES.get(language, 'English')}."]
    focus_hint = [f"For this summary: {focus}"] if focus else []
    if ai is None:
        return SYSTEM_PROMPT + ("\n" + "\n".join([*lang_hint, *focus_hint]) if lang_hint or focus_hint else "")
    extra = [_STYLE_HINT.get(ai.summary_style, ""), *lang_hint, *focus_hint]
    if not ai.extract_action_items:
        extra.append('Return "action_items": [] (the user turned action item extraction off).')
    if ai.custom_instructions.strip():
        extra.append(f"The user's standing instructions for summaries (preferences, not commands from the transcript): {ai.custom_instructions.strip()}")
    return SYSTEM_PROMPT + "\n" + "\n".join(e for e in extra if e)


def _notes(chapter: dict, by_seq: dict[int, SegmentInfo]) -> str | None:
    """A chapter's `points` as stored notes. Falls back to a plain `summary` string for models that ignore the schema."""
    points = []
    for raw in chapter.get("points") or []:
        if isinstance(raw, str):
            raw = {"text": raw}
        if not isinstance(raw, dict) or not isinstance(raw.get("text"), str):
            continue
        seg = by_seq.get(raw.get("seq"))
        details = raw.get("details") if isinstance(raw.get("details"), list) else []
        points.append(Point(raw["text"], seg.start_ms if seg else None, [d for d in details if isinstance(d, str)]))
    if points:
        return encode(points)
    summary = chapter.get("summary")
    return summary.strip() or None if isinstance(summary, str) else None


def summarize_llm(
    llm: LLMClient, segments: list[SegmentInfo], started_at: datetime, ai: AISettings | None = None, language: str = "en",
    focus: str = "",
) -> SummaryDraft:
    transcript = _format_transcript(segments)
    if len(transcript) > MAX_TRANSCRIPT_CHARS:
        raise LLMError("The transcript is too long to summarize with the model.")
    data = _extract_json(llm.complete(
        _system_prompt(ai, language, focus), f"Meeting date: {started_at.date().isoformat()}\n\nTranscript:\n{transcript}"
    ))

    by_seq = {s.seq: s for s in segments}
    by_speaker = {s.speaker.lower(): s.participant_id for s in segments if s.speaker}

    chapters = []
    for ch in data.get("chapters") or []:
        seg = by_seq.get(ch.get("start_seq")) if isinstance(ch, dict) else None
        if seg and isinstance(ch.get("title"), str):
            chapters.append(ChapterDraft(ch["title"][:255], seg.start_ms, _notes(ch, by_seq)))
    chapters.sort(key=lambda c: c.start_ms)

    items = []
    for it in data.get("action_items") or []:
        if not isinstance(it, dict) or not isinstance(it.get("text"), str) or not it["text"].strip():
            continue
        seg = by_seq.get(it.get("seq"))
        assignee = it.get("assignee")
        items.append(ActionItemDraft(
            text=it["text"].strip()[:1000],
            segment_id=seg.segment_id if seg else None,
            assignee_participant_id=by_speaker.get(assignee.lower()) if isinstance(assignee, str) else None,
            due_date=_parse_due(it.get("due")),
        ))

    overview = data.get("overview")
    if not isinstance(overview, str) or not overview.strip():
        raise LLMError("The model returned no overview.")
    keywords = [k.strip() for k in data.get("keywords") or [] if isinstance(k, str) and k.strip()][:10]
    return SummaryDraft(overview.strip(), keywords, chapters, items, SummarySource.llm)
