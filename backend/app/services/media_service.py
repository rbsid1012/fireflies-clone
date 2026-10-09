"""Uploaded audio/video for a meeting, stored on disk (a persistent volume in production)."""
import os
import re
import secrets
from pathlib import Path

from fastapi import UploadFile

from app.config import settings
from app.errors import AppError, ValidationFailed

ALLOWED_EXTENSIONS = {".mp3", ".m4a", ".wav", ".mp4", ".webm", ".ogg", ".aac", ".mov"}
CHUNK = 1024 * 1024


def media_root() -> Path:
    root = Path(settings.media_dir)
    root.mkdir(parents=True, exist_ok=True)
    return root


def _safe_ext(filename: str | None) -> str:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationFailed(
            f"Unsupported media type '{ext or 'unknown'}'. Use MP3, M4A, WAV, MP4, WEBM, OGG, AAC or MOV.", "invalid_media"
        )
    return ext


def validate_upload(upload: UploadFile) -> str:
    """Cheap checks on the declared name and type. Returns the extension."""
    ext = _safe_ext(upload.filename)
    content_type = upload.content_type or ""
    if not re.match(r"^(audio|video)/", content_type) and content_type not in ("application/octet-stream", ""):
        raise ValidationFailed("That file is not audio or video.", "invalid_media")
    return ext


async def save_media(upload: UploadFile, owner_id: int, meeting_id: int) -> tuple[str, str]:
    """Stream the upload to disk with a size cap. Returns (relative path, content type)."""
    ext = validate_upload(upload)
    content_type = upload.content_type or ""
    rel = f"{owner_id}/{meeting_id}-{secrets.token_hex(4)}{ext}"
    dest = media_root() / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    limit = settings.max_media_mb * 1024 * 1024
    written = 0
    try:
        with dest.open("wb") as out:
            while chunk := await upload.read(CHUNK):
                written += len(chunk)
                if written > limit:
                    raise AppError(413, "media_too_large", f"Media files are limited to {settings.max_media_mb} MB.")
                out.write(chunk)
    except BaseException:
        dest.unlink(missing_ok=True)
        raise
    if written == 0:
        dest.unlink(missing_ok=True)
        raise ValidationFailed("The media file is empty.", "invalid_media")
    return rel, content_type or "application/octet-stream"


def resolve(rel_path: str) -> Path | None:
    """Absolute path of a stored file, refusing anything that escapes the media directory."""
    root = media_root().resolve()
    path = (root / rel_path).resolve()
    return path if root in path.parents and path.is_file() else None


def delete_media(rel_path: str | None) -> None:
    if rel_path and (path := resolve(rel_path)):
        path.unlink(missing_ok=True)
