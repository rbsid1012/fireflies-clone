from fastapi import APIRouter, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.errors import NotFoundError
from app.models import Meeting
from app.schemas.common import ERROR_RESPONSES
from app.schemas.meeting import MeetingDetail
from app.security import verify_media_sig
from app.services import media_service, meeting_service

router = APIRouter(tags=["media"])


@router.post("/api/meetings/{meeting_id}/media", response_model=MeetingDetail, status_code=201, responses=ERROR_RESPONSES)
async def upload_media(meeting_id: int, file: UploadFile, db: DbSession, user: CurrentUser):
    """Attach (or replace) the meeting's audio or video so the player and transcript can sync to it."""
    meeting_service.require_meeting(db, user, meeting_id)
    media_service.validate_upload(file)
    rel, content_type = await media_service.save_media(file, user.id, meeting_id)
    return meeting_service.attach_media(db, user, meeting_id, rel, content_type)


@router.delete("/api/meetings/{meeting_id}/media", response_model=MeetingDetail, responses=ERROR_RESPONSES)
def delete_media(meeting_id: int, db: DbSession, user: CurrentUser):
    return meeting_service.remove_media(db, user, meeting_id)


@router.get("/api/media/{meeting_id}", responses={404: ERROR_RESPONSES[404], 200: {"content": {"audio/*": {}, "video/*": {}}}})
def stream_media(meeting_id: int, sig: str, db: DbSession):
    """Streams the file (with Range support). Access is by the signed `sig` in the meeting's media URL,
    because an <audio> element can't send an Authorization header."""
    if not verify_media_sig(meeting_id, sig):
        raise NotFoundError("Media")
    meeting = db.scalar(select(Meeting).where(Meeting.id == meeting_id))
    path = media_service.resolve(meeting.media_path) if meeting and meeting.media_path else None
    if path is None:
        raise NotFoundError("Media")
    return FileResponse(path, media_type=meeting.media_type or "application/octet-stream")


