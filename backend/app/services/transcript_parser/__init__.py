"""Turn .txt / .vtt / .srt / .json (or pasted text) into timed, speaker-labelled segments."""
import json
import os

from app.services.transcript_parser.common import (
    ParsedSegment, ParsedTranscript, TranscriptParseError, finalize,
)
from app.services.transcript_parser.cues import parse_cues
from app.services.transcript_parser.json_format import parse_json
from app.services.transcript_parser.plain import parse_plain

MAX_BYTES = 5_000_000
SUPPORTED_EXTENSIONS = {".txt": "txt", ".vtt": "vtt", ".srt": "srt", ".json": "json", ".md": "txt"}

__all__ = ["ParsedSegment", "ParsedTranscript", "TranscriptParseError", "detect_format", "parse_transcript"]


def _decode(raw: bytes) -> str:
    if len(raw) > MAX_BYTES:
        raise TranscriptParseError(f"Transcript is too large (limit {MAX_BYTES // 1_000_000} MB).")
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise TranscriptParseError("The file is not UTF-8 text. Export the transcript as plain UTF-8.") from exc


def detect_format(text: str, filename: str | None = None) -> str:
    """Pick a parser from the file extension, falling back to sniffing the content."""
    if filename:
        ext = os.path.splitext(filename)[1].lower()
        if ext in SUPPORTED_EXTENSIONS:
            return SUPPORTED_EXTENSIONS[ext]
        if ext:
            raise TranscriptParseError(f"Unsupported file type '{ext}'. Use .txt, .vtt, .srt or .json.")
    head = text.lstrip("﻿ \n\r\t")
    if head.startswith("WEBVTT"):
        return "vtt"
    if head[:1] in "[{":
        try:
            json.loads(head)
            return "json"
        except json.JSONDecodeError:
            pass
    if "-->" in head:
        return "srt"
    return "txt"


def parse_transcript(
    content: str | bytes, filename: str | None = None, fmt: str = "auto"
) -> ParsedTranscript:
    text = _decode(content) if isinstance(content, bytes) else content
    if not text.strip():
        raise TranscriptParseError("The transcript is empty.")
    if fmt == "auto":
        fmt = detect_format(text, filename)
    parser = {"vtt": parse_cues, "srt": parse_cues, "json": parse_json, "txt": parse_plain}[fmt]
    return finalize(parser(text))
