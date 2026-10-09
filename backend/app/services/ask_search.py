"""Ask Fred without a language model: intent detection plus answers built from your own data.

This is a real feature, not a placeholder: for the common questions ("what are my action items",
"what decisions were made") the answer comes straight from the structured data, and any other
question is answered with the best-matching transcript moments.
"""
import re
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models import Meeting, TranscriptSegment, User
from app.schemas.ask import AskOut, AskSource
from app.services.ask_data import action_item_source, load_segments, source_for
from app.services.formatting import format_timestamp
from app.services.notes_format import plain
from app.services.search_service import build_fts_any_query, search_segments

_ACTIONS = re.compile(r"action items?|tasks?\b|to-?dos?|follow-?ups?|assigned|deliverables?", re.I)
_DECISIONS = re.compile(r"decision|decided|agreed?|conclusion|resolved|settled", re.I)
_TOPICS = re.compile(r"main topics?|topics?\b|summar|overview|recap|key points?|what was .{0,30}about|tl;?dr", re.I)
_CHALLENGES = re.compile(r"challenge|issues?\b|problems?|risks?|blockers?|concerns?|difficult", re.I)
_INITIATIVES = re.compile(r"initiatives?|priorit|roadmap|plans?\b|goals?|next steps?", re.I)
_MINE = re.compile(r"\b(my|mine|i'?m|assigned to me)\b", re.I)

# Sentences that sound like a decision or a problem; used to pick segments for those intents
_DECISION_TEXT = re.compile(r"\b(we(?:'ll| will| have)? (?:decided|agreed|go with|going with|chose|settled)|let'?s (?:go with|do|make|ship|put)|decision|agreed|the plan is|we'?re going to|that works|sounds good,? let)", re.I)
_CHALLENGE_TEXT = re.compile(r"\b(blocker|blocked|problem|issue|risk|concern|challenge|difficult|worried|failed|broken|delay|slow|bug|outage|incident|can'?t|couldn'?t)\b", re.I)

MAX_BULLETS = 8


@dataclass
class Found:
    line: str
    source: AskSource


def _titles(meetings: list[Meeting]) -> dict[int, str]:
    return {m.id: m.title for m in meetings}


def _bullet(segment: TranscriptSegment, titles: dict[int, str], multi: bool) -> Found:
    who = segment.speaker_name or "Unknown"
    prefix = f"**{titles.get(segment.meeting_id, '')}** · " if multi else ""
    return Found(f"• {prefix}[{format_timestamp(segment.start_ms)}] {who}: {segment.text}", source_for(segment, titles))


def _result(heading: str, found: list[Found], empty: str) -> AskOut:
    if not found:
        return AskOut(answer=empty, mode="search", model=None, sources=[])
    body = "\n".join(f.line for f in found[:MAX_BULLETS])
    return AskOut(answer=f"**{heading}**\n{body}", mode="search", model=None, sources=[f.source for f in found[:MAX_BULLETS]])


def _action_items(user: User, meetings: list[Meeting], question: str) -> AskOut:
    titles, multi = _titles(meetings), len(meetings) > 1
    items = [(m, a) for m in meetings for a in m.action_items if not a.is_completed]
    note = ""
    if _MINE.search(question):
        mine = [(m, a) for m, a in items if a.assignee and (a.assignee.email == user.email or a.assignee.name.lower() == user.name.lower())]
        if mine:
            items = mine
        else:
            note = "\n_Nothing is assigned to you by name, so here is everything still open._"
    if not items:
        return AskOut(answer="There are no open action items.", mode="search", model=None, sources=[])
    lines, sources = [], []
    for m, a in items[:MAX_BULLETS]:
        bits = [a.assignee.name] if a.assignee else []
        if a.due_date:
            bits.append(f"due {a.due_date:%b %-d}")
        suffix = f" ({', '.join(bits)})" if bits else ""
        lines.append(f"• {('**' + m.title + '** · ') if multi else ''}{a.text}{suffix}")
        sources.append(action_item_source(a, titles))
    more = f"\n…and {len(items) - MAX_BULLETS} more." if len(items) > MAX_BULLETS else ""
    return AskOut(answer=f"**Open action items** ({len(items)})\n" + "\n".join(lines) + more + note, mode="search", model=None, sources=sources)


def _topics(meetings: list[Meeting]) -> AskOut:
    multi = len(meetings) > 1
    parts, sources = [], []
    for m in meetings[:5]:
        if not m.summary:
            continue
        head = f"**{m.title}**\n" if multi else ""
        keywords = f"\nKeywords: {', '.join(m.summary.keywords)}" if m.summary.keywords else ""
        outline = "\n".join(f"• [{format_timestamp(c.start_ms)}] {c.title}" for c in m.chapters[:6])
        parts.append(f"{head}{m.summary.overview}{keywords}" + (f"\n{outline}" if outline else ""))
        sources.append(AskSource(meeting_id=m.id, meeting_title=m.title, segment_id=None, start_ms=0, speaker_name=None, text=m.summary.overview[:200]))
    if not parts:
        return AskOut(answer="There is no summary to draw on yet.", mode="search", model=None, sources=[])
    return AskOut(answer="\n\n".join(parts), mode="search", model=None, sources=sources)


def _initiatives(meetings: list[Meeting]) -> AskOut:
    multi = len(meetings) > 1
    lines, sources = [], []
    for m in meetings[:6]:
        for c in m.chapters[:5]:
            lines.append(f"• {('**' + m.title + '** · ') if multi else ''}[{format_timestamp(c.start_ms)}] {c.title}" + (f": {plain(c.summary)}" if c.summary else ""))
            sources.append(AskSource(meeting_id=m.id, meeting_title=m.title, segment_id=None, start_ms=c.start_ms, speaker_name=None, text=plain(c.summary) or c.title))
    if not lines:
        return AskOut(answer="There is no outline to draw on yet.", mode="search", model=None, sources=[])
    return AskOut(answer="**Key initiatives and next steps**\n" + "\n".join(lines[:MAX_BULLETS]), mode="search", model=None, sources=sources[:MAX_BULLETS])


def _scan(db: Session, meetings: list[Meeting], pattern: re.Pattern[str]) -> list[Found]:
    """Segments matching `pattern`. Questions are skipped: "What drove the decision?" is not a decision."""
    titles, multi = _titles(meetings), len(meetings) > 1
    hits = [s for s in load_segments(db, meetings) if "?" not in s.text and pattern.search(s.text)]
    return [_bullet(s, titles, multi) for s in hits][:MAX_BULLETS]


def _no_result_help() -> AskOut:
    return AskOut(
        answer="I couldn't find that in your transcripts. Try asking about **action items**, **key decisions**, "
               "**main topics**, **challenges**, or use specific words someone would have said.",
        mode="search", model=None, sources=[],
    )


# Only short pleasantries: "hi, what are the action items" is a real question and must not match
_SMALL_TALK = re.compile(
    r"^\s*(?:hi|hey|hello|hiya|yo|sup|good (?:morning|afternoon|evening)|how are you|how's it going|what's up|thanks|thank you|thx|"
    r"who are you|what can you do)\b[^a-z0-9]*(?:\w+[^a-z0-9]*){0,2}$", re.IGNORECASE,
)


def _small_talk(user: User) -> AskOut:
    first = user.name.split()[0] if user.name.strip() else "there"
    return AskOut(
        answer=f"Hi {first}! I'm Fred. I can pull action items, key decisions and topics out of your meetings, or find "
               "where someone said something. Try **my action items**, **key decisions**, or ask about a word like “budget”.",
        mode="search", model=None, sources=[],
    )


def answer(db: Session, user: User, question: str, meetings: list[Meeting], meeting_id: int | None) -> AskOut:
    if _SMALL_TALK.match(question):
        return _small_talk(user)
    if _ACTIONS.search(question):
        return _action_items(user, meetings, question)
    if _DECISIONS.search(question):
        return _result("Key decisions", _scan(db, meetings, _DECISION_TEXT), "I didn't find any clear decisions in the transcript.")
    if _CHALLENGES.search(question):
        return _result("Challenges and issues raised", _scan(db, meetings, _CHALLENGE_TEXT), "No challenges or issues stand out in the transcript.")
    if _TOPICS.search(question):
        return _topics(meetings)
    if _INITIATIVES.search(question):
        return _initiatives(meetings)

    query = build_fts_any_query(question)
    if query is None:
        return _no_result_help()
    hits = search_segments(db, user, query, meeting_id, MAX_BULLETS)
    if not hits:
        return _no_result_help()
    titles, multi = _titles(meetings), len(meetings) > 1
    found = [_bullet(s, titles, multi) for s in hits]
    return _result("Most relevant moments", found, "")
