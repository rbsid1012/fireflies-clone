"""Speech-to-text for uploaded recordings, through any OpenAI-compatible `/audio/transcriptions` endpoint.

Groq (whisper-large-v3-turbo) is the free option. Whisper does not tell speakers apart, so every line
is attributed to "Speaker"; the timings are real. The result is a VTT document that goes through the
same parser as an uploaded transcript.
"""
import os
import subprocess
import httpx

from app.config import settings
from app.errors import AppError, ValidationFailed

MAX_STT_BYTES = 25 * 1024 * 1024  # the free tiers' limit
SPEAKER = "Speaker"


# What the speech-to-text API can read. Other recordings can still be attached to a meeting that has a transcript.
STT_EXTENSIONS = {".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".wav", ".webm", ".ogg", ".oga", ".opus", ".flac"}


# Containers the speech service reads once they carry a name it recognises (it checks the content, not the name).
RENAME_FOR_STT = {".mov": ".mp4", ".m4v": ".mp4", ".3gp": ".mp4", ".mkv": ".webm"}
# Formats it cannot read at all: converted to MP3 on the server first.
CONVERT_FOR_STT = {".aac", ".wma", ".avi", ".amr", ".mpg"}


def _to_mp3(data: bytes) -> bytes:
    """Re-encode to a small mono MP3 (about 0.4 MB per minute) with a bundled ffmpeg."""
    try:
        import imageio_ffmpeg

        proc = subprocess.run(
            [imageio_ffmpeg.get_ffmpeg_exe(), "-loglevel", "error", "-i", "pipe:0", "-vn", "-ac", "1", "-ar", "16000",
             "-b:a", "48k", "-f", "mp3", "pipe:1"],
            input=data, capture_output=True, timeout=120,
        )
    except (ImportError, OSError, subprocess.TimeoutExpired) as exc:
        raise ValidationFailed("This recording format can't be converted on the server. Upload a transcript with it.", "unsupported_for_transcription") from exc
    if proc.returncode != 0 or not proc.stdout:
        raise ValidationFailed("That recording could not be read. Try MP3, M4A or WAV, or upload a transcript with it.", "unreadable_recording")
    return proc.stdout


def available() -> bool:
    return bool(settings.llm_api_key and settings.llm_base_url)


def _stamp(seconds: float) -> str:
    ms = max(0, int(round(seconds * 1000)))
    h, rem = divmod(ms, 3_600_000)
    m, rem = divmod(rem, 60_000)
    s, milli = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{milli:03d}"


def _hallucinated(text: str, start: float, end: float) -> bool:
    """Whisper invents short filler ("Thank you.") over long stretches of silence. Real speech is never this slow."""
    return end - start > 10 and len(text.split()) / (end - start) < 0.5


def to_vtt(segments: list[dict]) -> str:
    cues = []
    for i, seg in enumerate(segments, 1):
        text = " ".join(str(seg.get("text", "")).split())
        if not text:
            continue
        start, end = float(seg.get("start", 0)), float(seg.get("end", 0))
        if _hallucinated(text, start, end):
            continue
        if end <= start:
            end = start + 1.0
        cues.append(f"{len(cues) + 1}\n{_stamp(start)} --> {_stamp(end)}\n<v {SPEAKER}>{text}\n")
    return "WEBVTT\n\n" + "\n".join(cues)


def transcribe(data: bytes, filename: str, content_type: str | None, client: httpx.Client | None = None) -> str:
    """Return a VTT transcript for the recording, or raise a user-readable error."""
    if not available():
        raise ValidationFailed(
            "Transcribing a recording needs a speech-to-text provider. Add a transcript file with it, or set LLM_BASE_URL and LLM_API_KEY on the server.",
            "transcription_unavailable",
        )
    ext = os.path.splitext(filename)[1].lower()
    if ext in RENAME_FOR_STT:
        filename, ext = f"recording{RENAME_FOR_STT[ext]}", RENAME_FOR_STT[ext]
    elif ext in CONVERT_FOR_STT:
        data, filename, content_type, ext = _to_mp3(data), "recording.mp3", "audio/mpeg", ".mp3"
    if ext not in STT_EXTENSIONS:
        raise ValidationFailed(
            f"{ext or 'That'} recordings can't be transcribed automatically. Convert it to MP3, M4A, WAV, FLAC or MP4, or upload a transcript with it.",
            "unsupported_for_transcription",
        )
    if len(data) > MAX_STT_BYTES:
        raise ValidationFailed(f"That recording is too large to transcribe automatically (the limit is {MAX_STT_BYTES // (1024 * 1024)} MB). Upload a transcript with it instead.", "recording_too_large")
    http = client or httpx.Client(timeout=180.0)
    try:
        response = http.post(
            f"{settings.llm_base_url.rstrip('/')}/audio/transcriptions",
            headers={"Authorization": f"Bearer {settings.llm_api_key}"},
            data={"model": settings.stt_model, "response_format": "verbose_json", "temperature": "0"},
            files={"file": (filename, data, content_type or "application/octet-stream")},
        )
    except httpx.HTTPError as exc:
        raise AppError(502, "transcription_error", "Could not reach the transcription service.") from exc
    if response.status_code in (401, 403):
        raise AppError(502, "transcription_error", "The configured LLM_API_KEY was rejected by the transcription service.")
    if response.status_code == 429:
        raise AppError(502, "transcription_error", "The transcription service is rate limited right now. Try again shortly.")
    if response.status_code >= 400:
        raise AppError(502, "transcription_error", f"The transcription service returned an error ({response.status_code}).")
    try:
        body = response.json()
    except ValueError as exc:
        raise AppError(502, "transcription_error", "The transcription service returned an unexpected response.") from exc
    segments = body.get("segments") or []
    if segments:
        vtt = to_vtt(segments)
        if "-->" in vtt:
            return vtt
    text = " ".join(str(body.get("text", "")).split())
    if not text:
        raise ValidationFailed("No speech was found in that recording.", "empty_transcript")
    return f"{SPEAKER}: {text}"
