"""Shared types and helpers for the transcript format parsers."""
import re
from dataclasses import dataclass

from app.services.timing import GAP_MS, LEAD_IN_MS, MIN_SEGMENT_MS, MS_PER_WORD, estimate_timings

MAX_SEGMENTS = 20_000

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")
# mm:ss or h:mm:ss, optional fractional seconds with . or , (VTT vs SRT)
TS_PATTERN = r"\d{1,2}(?::\d{2}){1,2}(?:[.,]\d{1,3})?"
_TS_RE = re.compile(r"^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$")


class TranscriptParseError(ValueError):
    """The input could not be turned into a transcript. The message is shown to the user."""


@dataclass
class RawItem:
    """One utterance before timings are resolved. Any of speaker/start/end may be unknown."""

    text: str
    speaker: str | None = None
    start_ms: int | None = None
    end_ms: int | None = None


@dataclass
class ParsedSegment:
    speaker: str
    start_ms: int
    end_ms: int
    text: str


@dataclass
class ParsedTranscript:
    segments: list[ParsedSegment]
    synthesized: bool  # True when no timestamps were present and timings were estimated


def clean_text(text: str) -> str:
    # Control chars are stripped because FTS highlighting uses \x02/\x03 as sentinels.
    return " ".join(_CONTROL_CHARS.sub("", text).split())


def parse_timestamp(value: str) -> int | None:
    m = _TS_RE.match(value.strip())
    if not m:
        return None
    hours, minutes, seconds, frac = m.groups()
    ms = int(frac.ljust(3, "0")) if frac else 0
    return ((int(hours or 0) * 60 + int(minutes)) * 60 + int(seconds)) * 1000 + ms


def finalize(items: list[RawItem]) -> ParsedTranscript:
    """Drop empties, fill in missing speakers, and resolve every timing to integer ms."""
    items = [i for i in items if i.text]
    if not items:
        raise TranscriptParseError("No transcript text was found.")
    if len(items) > MAX_SEGMENTS:
        raise TranscriptParseError(f"Transcript has too many segments (limit {MAX_SEGMENTS}).")

    last_speaker = None
    for item in items:
        item.speaker = item.speaker or last_speaker or "Speaker 1"
        last_speaker = item.speaker

    if all(i.start_ms is None for i in items):
        timings = estimate_timings([i.text for i in items])
        segs = [ParsedSegment(i.speaker, s, e, i.text) for i, (s, e) in zip(items, timings)]
        return ParsedTranscript(segs, synthesized=True)

    segs: list[ParsedSegment] = []
    prev_start, prev_end = 0, None
    for idx, item in enumerate(items):
        start = item.start_ms
        if start is None:
            start = LEAD_IN_MS if prev_end is None else prev_end + GAP_MS
        start = max(start, prev_start)  # never go backwards

        next_known = next((n.start_ms for n in items[idx + 1:] if n.start_ms is not None), None)
        end = item.end_ms
        if end is None or end <= start:
            estimate = max(MIN_SEGMENT_MS, len(item.text.split()) * MS_PER_WORD)
            end = start + estimate
            if next_known is not None and next_known > start:
                end = min(end, next_known)
        end = max(end, start + 1)
        segs.append(ParsedSegment(item.speaker, start, end, item.text))
        prev_start, prev_end = start, end
    return ParsedTranscript(segs, synthesized=False)
