"""How a chapter's notes are stored in `Chapter.summary`: an indented bullet list, one point per line.

    - Beta launch delayed to October 23rd {@45000}
      - Crash rate 0.4%
      - Push notification bug unresolved

`{@ms}` is the transcript moment a point came from. Plain prose (older meetings, seed data) is still valid:
`parse` treats each sentence as a point.
"""
import re
from dataclasses import dataclass, field

_MARK = re.compile(r"\s*\{@(\d+)\}\s*$")
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
MAX_POINTS, MAX_SUBS, MAX_LEN = 8, 5, 300


@dataclass
class Point:
    text: str
    ms: int | None = None
    subs: list[str] = field(default_factory=list)


def _clean(text: object, limit: int = MAX_LEN) -> str:
    return re.sub(r"\s+", " ", text).strip()[:limit] if isinstance(text, str) else ""


def encode(points: list[Point]) -> str | None:
    lines: list[str] = []
    for p in points[:MAX_POINTS]:
        text = _clean(p.text)
        if not text:
            continue
        lines.append(f"- {text}" + (f" {{@{p.ms}}}" if p.ms is not None else ""))
        lines.extend(f"  - {s}" for s in (_clean(s) for s in p.subs[:MAX_SUBS]) if s)
    return "\n".join(lines) or None


def parse(summary: str | None) -> list[Point]:
    points: list[Point] = []
    for raw in (summary or "").splitlines():
        if not raw.strip():
            continue
        m = re.match(r"^(\s*)[-•○*]\s+(.*)$", raw)
        if not m:  # prose: split into sentences
            points.extend(Point(s) for s in _SENTENCE_SPLIT.split(raw.strip()) if s)
            continue
        text = m.group(2).strip()
        if m.group(1) and points:
            points[-1].subs.append(_MARK.sub("", text))
            continue
        mark = _MARK.search(text)
        points.append(Point(_MARK.sub("", text), int(mark.group(1)) if mark else None))
    return points


def plain(summary: str | None) -> str:
    """The notes as flowing text with no markers, for search results, exports and prompts."""
    return " ".join(
        p.text.rstrip(".") + (f" ({'; '.join(p.subs)})" if p.subs else "") + "." for p in parse(summary)
    )
