"""Full-text search over transcripts, backed by the transcript_fts FTS5 table."""
import re

from sqlalchemy import select, text
from sqlalchemy.orm import Session, selectinload

from app.models import Meeting, MeetingParticipant, TranscriptSegment, User
from app.schemas.search import SearchHit, SearchOut, SnippetPart
from app.schemas.transcript import MatchSpan, SegmentMatch, TranscriptSearchOut

# FTS5 highlight()/snippet() wrap matches in these. Control characters never occur
# in stored text (the parsers strip them), so splitting on them is unambiguous.
OPEN, CLOSE = "\x02", "\x03"
MAX_TERMS = 12


def build_fts_query(raw: str) -> str | None:
    """Turn user input into a safe FTS5 MATCH expression, or None if it has no searchable words.

    Words are quoted individually (so operators like AND/NEAR/- or stray quotes can't
    break the query), "quoted phrases" are kept as phrases, and the final bare word
    is a prefix match so results narrow as the user types.
    """
    tokens = re.findall(r'"([^"]*)"|(\w+)', raw)[:MAX_TERMS]
    parts: list[str] = []
    last_is_word = False
    for phrase, word in tokens:
        if phrase:
            words = re.findall(r"\w+", phrase)
            if words:
                parts.append('"' + " ".join(words) + '"')
                last_is_word = False
        elif word:
            parts.append(f'"{word}"')
            last_is_word = True
    if not parts:
        return None
    if last_is_word:
        parts[-1] += "*"
    return " ".join(parts)


_QUESTION_WORDS = {"what", "who", "whom", "when", "where", "why", "how", "which", "does", "did", "was", "were", "tell", "show", "give", "about", "discuss", "discussed", "talk", "talked", "say", "said", "meeting", "meetings", "mention", "mentioned", "please", "can", "could"}


def build_fts_any_query(raw: str) -> str | None:
    """A forgiving OR query for natural-language questions: any content word may match."""
    from app.services.text_stats import STOPWORDS

    words = []
    for w in re.findall(r"\w+", raw.lower()):
        if len(w) > 2 and w not in STOPWORDS and w not in _QUESTION_WORDS and w not in words:
            words.append(w)
    return " OR ".join(f'"{w}"*' for w in words[:10]) or None


def search_segments(db: Session, owner: User, fts_query: str, meeting_id: int | None, limit: int) -> list[TranscriptSegment]:
    """The best-matching segments, best first, across the owner's meetings or within one."""
    sql = (
        "SELECT s.id FROM transcript_fts JOIN transcript_segments s ON s.id = transcript_fts.rowid "
        "JOIN meetings m ON m.id = s.meeting_id WHERE transcript_fts MATCH :q AND m.owner_id = :uid"
        + (" AND s.meeting_id = :mid" if meeting_id is not None else "")
        + " ORDER BY bm25(transcript_fts) LIMIT :n"
    )
    ids = [r[0] for r in db.execute(text(sql), {"q": fts_query, "uid": owner.id, "mid": meeting_id, "n": limit})]
    if not ids:
        return []
    rows = {
        s.id: s for s in db.scalars(
            select(TranscriptSegment).where(TranscriptSegment.id.in_(ids))
            .options(selectinload(TranscriptSegment.participant).selectinload(MeetingParticipant.person))
        )
    }
    return [rows[i] for i in ids]


def meeting_id_match_clause(fts_query: str):
    """SQL fragment for 'meetings.id has a transcript segment matching the query'."""
    return text(
        "meetings.id IN (SELECT meeting_id FROM transcript_fts WHERE transcript_fts MATCH :fts_q)"
    ).bindparams(fts_q=fts_query)


def split_marked(marked: str) -> list[SnippetPart]:
    parts, buf, inside = [], [], False
    for ch in marked:
        if ch in (OPEN, CLOSE):
            if buf:
                parts.append(SnippetPart(text="".join(buf), match=inside))
                buf = []
            inside = ch == OPEN
        else:
            buf.append(ch)
    if buf:
        parts.append(SnippetPart(text="".join(buf), match=False))
    return parts


def offsets_from_marked(marked: str) -> tuple[str, list[MatchSpan]]:
    """Strip sentinels from highlight() output, returning the plain text and match spans."""
    plain: list[str] = []
    spans: list[MatchSpan] = []
    start = None
    for ch in marked:
        if ch == OPEN:
            start = len(plain)
        elif ch == CLOSE:
            if start is not None and len(plain) > start:
                spans.append(MatchSpan(start=start, end=len(plain)))
            start = None
        else:
            plain.append(ch)
    return "".join(plain), spans


def global_search(db: Session, owner: User, query: str, page: int, limit: int) -> SearchOut:
    fts = build_fts_query(query)
    if fts is None:
        return SearchOut(query=query, total=0, page=page, limit=limit, hits=[])

    base = (
        "FROM transcript_fts "
        "JOIN transcript_segments s ON s.id = transcript_fts.rowid "
        "JOIN meetings m ON m.id = s.meeting_id "
        "WHERE transcript_fts MATCH :q AND m.owner_id = :uid"
    )
    params = {"q": fts, "uid": owner.id}
    total = db.execute(text(f"SELECT count(*) {base}"), params).scalar_one()
    rows = db.execute(
        text(
            f"SELECT s.id AS segment_id, snippet(transcript_fts, 0, :o, :c, '…', 24) AS snip {base} "
            "ORDER BY bm25(transcript_fts), m.started_at DESC, s.seq LIMIT :limit OFFSET :offset"
        ),
        {**params, "o": OPEN, "c": CLOSE, "limit": limit, "offset": (page - 1) * limit},
    ).all()

    snippets = {r.segment_id: r.snip for r in rows}
    segments = {
        s.id: s for s in db.scalars(
            select(TranscriptSegment)
            .where(TranscriptSegment.id.in_(snippets))
            .options(selectinload(TranscriptSegment.participant).selectinload(MeetingParticipant.person))
        )
    }
    meetings = {m.id: m for m in db.scalars(select(Meeting).where(Meeting.id.in_({s.meeting_id for s in segments.values()})))}

    hits = []
    for row in rows:  # preserve bm25 order
        seg = segments[row.segment_id]
        meeting = meetings[seg.meeting_id]
        hits.append(SearchHit(
            meeting_id=meeting.id, meeting_title=meeting.title, meeting_started_at=meeting.started_at,
            segment_id=seg.id, seq=seg.seq, start_ms=seg.start_ms, speaker_name=seg.speaker_name,
            snippet=split_marked(row.snip),
        ))
    return SearchOut(query=query, total=total, page=page, limit=limit, hits=hits)


def search_in_meeting(db: Session, meeting_id: int, query: str) -> TranscriptSearchOut:
    fts = build_fts_query(query)
    if fts is None:
        return TranscriptSearchOut(query=query, total_matches=0, segments=[])
    rows = db.execute(
        text(
            "SELECT s.id AS segment_id, s.seq, s.start_ms, "
            "highlight(transcript_fts, 0, :o, :c) AS marked "
            "FROM transcript_fts JOIN transcript_segments s ON s.id = transcript_fts.rowid "
            "WHERE transcript_fts MATCH :q AND s.meeting_id = :mid ORDER BY s.seq"
        ),
        {"q": fts, "mid": meeting_id, "o": OPEN, "c": CLOSE},
    ).all()
    segments = []
    for row in rows:
        _, spans = offsets_from_marked(row.marked)
        if spans:
            segments.append(SegmentMatch(segment_id=row.segment_id, seq=row.seq, start_ms=row.start_ms, matches=spans))
    return TranscriptSearchOut(
        query=query, total_matches=sum(len(s.matches) for s in segments), segments=segments
    )



