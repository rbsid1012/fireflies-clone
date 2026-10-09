"""JSON transcripts: [{speaker, start, end, text}, ...] with seconds or milliseconds."""
import json
import statistics
from typing import Any

from app.services.transcript_parser.common import (
    RawItem, TranscriptParseError, clean_text, parse_timestamp,
)

_LIST_KEYS = ("segments", "transcript", "utterances", "results", "items")
_TEXT_KEYS = ("text", "content", "sentence", "utterance", "transcript")
_SPEAKER_KEYS = ("speaker", "speaker_name", "speaker_label", "name")
_MS_START, _MS_END = ("start_ms", "startMs"), ("end_ms", "endMs")
_START_KEYS = ("start", "start_time", "startTime", "from")
_END_KEYS = ("end", "end_time", "endTime", "to")


def _first(entry: dict, keys: tuple[str, ...]) -> Any:
    for k in keys:
        if k in entry and entry[k] is not None:
            return entry[k]
    return None


def _is_number(v: Any) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def _numeric_or_ts(v: Any) -> tuple[bool, float | None]:
    """Return (is_absolute_ms, value). Timestamp strings are always absolute ms."""
    if v is None:
        return False, None
    if _is_number(v):
        return False, float(v)
    if isinstance(v, str):
        ts = parse_timestamp(v)
        if ts is not None:
            return True, float(ts)
        try:
            return False, float(v)
        except ValueError:
            pass
    raise TranscriptParseError(f"Unrecognised timestamp value: {v!r}")


def _seconds_or_ms(starts: list[float], ends: list[float | None]) -> float:
    """Return the multiplier that converts the numeric values to ms (1000 for seconds, 1 for ms)."""
    values = starts + [e for e in ends if e is not None]
    if any(v != int(v) for v in values):
        return 1000.0  # fractional values are seconds in practice
    spans = [e - s for s, e in zip(starts, ends) if e is not None and e > s]
    if not spans and len(starts) > 1:
        spans = [b - a for a, b in zip(starts, starts[1:]) if b > a]
    # A median utterance under 100 units is only plausible as seconds (100 ms is not speech)
    return 1000.0 if spans and statistics.median(spans) < 100 else 1.0


def parse_json(content: str) -> list[RawItem]:
    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise TranscriptParseError(f"Invalid JSON: {exc.msg} (line {exc.lineno}).") from exc
    if isinstance(data, dict):
        data = next((data[k] for k in _LIST_KEYS if isinstance(data.get(k), list)), None)
    if not isinstance(data, list) or not data:
        raise TranscriptParseError("JSON must be a non-empty list of {speaker, start, end, text} objects.")

    rows = []  # (text, speaker, (is_absolute, start), (is_absolute, end))
    explicit_ms = False
    for i, entry in enumerate(data, 1):
        if not isinstance(entry, dict):
            raise TranscriptParseError(f"Entry {i} is not an object.")
        text = _first(entry, _TEXT_KEYS)
        if not isinstance(text, str):
            raise TranscriptParseError(f"Entry {i} is missing a 'text' field.")
        speaker = _first(entry, _SPEAKER_KEYS)
        if _is_number(speaker):
            speaker = f"Speaker {int(speaker)}"
        ms_start, ms_end = _first(entry, _MS_START), _first(entry, _MS_END)
        explicit_ms = explicit_ms or ms_start is not None or ms_end is not None
        start = ms_start if ms_start is not None else _first(entry, _START_KEYS)
        end = ms_end if ms_end is not None else _first(entry, _END_KEYS)
        rows.append((text, speaker if isinstance(speaker, str) else None,
                     _numeric_or_ts(start), _numeric_or_ts(end)))

    # Only bare numbers need unit detection; "00:01:23" strings are already absolute.
    pairs = [
        (s_val, e_val if e_val is not None and not e_abs else None)
        for _, _, (s_abs, s_val), (e_abs, e_val) in rows
        if s_val is not None and not s_abs
    ]
    if explicit_ms or not pairs:
        factor = 1.0
    else:
        factor = _seconds_or_ms([p[0] for p in pairs], [p[1] for p in pairs])

    def to_ms(spec: tuple[bool, float | None]) -> int | None:
        absolute, value = spec
        if value is None:
            return None
        return int(round(value if absolute else value * factor))

    items = [
        RawItem(text=clean_text(text), speaker=clean_text(sp) or None if sp else None,
                start_ms=to_ms(s), end_ms=to_ms(e))
        for text, sp, s, e in rows
    ]
    if all(i.start_ms is not None for i in items):
        items.sort(key=lambda i: i.start_ms)
    return items
