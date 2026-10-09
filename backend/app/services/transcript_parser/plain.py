"""Plain-text transcripts.

Recognised line shapes (first match wins):
    [00:01:23] Speaker: text      [00:01:23] text
    Speaker (00:01:23): text
    00:01:23 Speaker: text
    Speaker: text
Anything else continues the previous utterance.
"""
import re

from app.services.transcript_parser.common import TS_PATTERN, RawItem, clean_text, parse_timestamp

_BRACKETED = re.compile(rf"^\[(?P<ts>{TS_PATTERN})\]\s*(?:(?P<sp>[^:\n]{{1,60}}?)\s*:\s*)?(?P<text>.*)$")
_PARENS = re.compile(rf"^(?P<sp>[^:\n(]{{1,60}}?)\s*\((?P<ts>{TS_PATTERN})\)\s*:\s*(?P<text>.*)$")
_LEADING = re.compile(rf"^(?P<ts>{TS_PATTERN})\s+(?:(?P<sp>[^:\n]{{1,60}}?)\s*:\s*)?(?P<text>\S.*)$")
_BARE = re.compile(r"^(?P<sp>[^:\n]{1,60}?)\s*:\s*(?P<text>\S.*)$")

# Words that start many "Label: ..." lines which are not speaker names
_NOT_SPEAKERS = {
    "note", "notes", "agenda", "summary", "topic", "topics", "action", "update", "reminder",
    "warning", "tip", "example", "todo", "fyi", "re", "subject", "date", "time", "location",
}


def _plausible_speaker(label: str, known: set[str]) -> bool:
    """Decide whether 'Label' in 'Label: text' is a person rather than a sentence fragment."""
    if label in known:
        return True
    words = label.split()
    if not 1 <= len(words) <= 4 or label.lower().split()[0] in _NOT_SPEAKERS:
        return False
    return all(w[0].isupper() or w[0].isdigit() for w in words) and not label.endswith(("?", "!", ","))


def parse_plain(content: str) -> list[RawItem]:
    items: list[RawItem] = []
    known: set[str] = set()
    pending_ts: int | None = None

    def add(text: str, speaker: str | None, ts: int | None) -> None:
        nonlocal pending_ts
        speaker = clean_text(speaker) if speaker else None
        if speaker:
            known.add(speaker)
        items.append(RawItem(text=clean_text(text), speaker=speaker, start_ms=ts if ts is not None else pending_ts))
        pending_ts = None

    for raw in content.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = raw.strip()
        if not line:
            continue
        for pattern, timestamped in ((_BRACKETED, True), (_PARENS, True), (_LEADING, True), (_BARE, False)):
            m = pattern.match(line)
            if not m:
                continue
            speaker = m.groupdict().get("sp")
            if speaker and not timestamped and not _plausible_speaker(clean_text(speaker), known):
                continue
            if speaker and timestamped and len(speaker.split()) > 5:
                continue
            ts = parse_timestamp(m.group("ts")) if timestamped else None
            text = m.group("text")
            if not clean_text(text) and not speaker:
                pending_ts = ts  # a bare "[00:01:23]" line stamps the next line
            else:
                add(text, speaker, ts)
            break
        else:
            if items:
                items[-1].text = clean_text(f"{items[-1].text} {line}")
            else:
                add(line, None, None)
    return items
