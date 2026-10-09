"""WebVTT and SRT: blocks of [id] / "start --> end" / text lines."""
import html
import re

from app.services.transcript_parser.common import (
    RawItem, TranscriptParseError, clean_text, parse_timestamp,
)

_VOICE_TAG = re.compile(r"<v(?:\.[^\s>]+)*\s+([^>]+)>")
_ANY_TAG = re.compile(r"<[^>]+>")
# "Alice Smith: hello" - 1-4 capitalised words then a colon
_SPEAKER_PREFIX = re.compile(r"^([A-Z][\w.'\-]*(?: [A-Za-z][\w.'\-]*){0,3}):\s+(\S.*)$")
_SKIP_BLOCKS = ("WEBVTT", "NOTE", "STYLE", "REGION")


def _split_speaker(raw: str) -> tuple[str | None, str]:
    speaker = None
    voice = _VOICE_TAG.search(raw)
    if voice:
        speaker = voice.group(1).strip()
    text = html.unescape(_ANY_TAG.sub("", raw))
    if speaker is None:
        m = _SPEAKER_PREFIX.match(text.strip())
        if m:
            speaker, text = m.group(1), m.group(2)
    return speaker, text


def parse_cues(content: str) -> list[RawItem]:
    blocks = re.split(r"\n\s*\n", content.replace("\r\n", "\n").replace("\r", "\n").strip())
    items: list[RawItem] = []
    for block in blocks:
        lines = [ln for ln in block.split("\n") if ln.strip()]
        if not lines or lines[0].lstrip("﻿").startswith(_SKIP_BLOCKS):
            continue
        timing_idx = next((i for i, ln in enumerate(lines) if "-->" in ln), None)
        if timing_idx is None:
            continue
        left, _, right = lines[timing_idx].partition("-->")
        start = parse_timestamp(left)
        end = parse_timestamp(right.split()[0]) if right.split() else None
        if start is None or end is None:
            raise TranscriptParseError(f"Invalid cue timing: {lines[timing_idx].strip()!r}")
        speaker, text = _split_speaker(" ".join(lines[timing_idx + 1:]))
        items.append(RawItem(text=clean_text(text), speaker=speaker, start_ms=start, end_ms=end))
    if not items:
        raise TranscriptParseError("No subtitle cues were found (expected 'start --> end' lines).")
    items.sort(key=lambda i: i.start_ms)  # stable
    return items
