import os
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query, Request, Response
from starlette.datastructures import UploadFile  # request.form() yields Starlette's class, not FastAPI's subclass

from app.deps import CurrentUser, DbSession, Llm, SessionFactory
from app.errors import ValidationFailed
from app.schemas.common import ERROR_RESPONSES, Page
from app.schemas.meeting import (
    MeetingCreateIn, MeetingDetail, MeetingFilters, MeetingListItem, MeetingUpdate,
)
from fastapi.concurrency import run_in_threadpool

from app.services import media_service, meeting_query, meeting_service, notifications, transcription_service
from app.services.transcript_parser import MAX_BYTES

router = APIRouter(prefix="/api/meetings", tags=["meetings"])

_FORM_FIELDS = ("title", "started_at", "format", "transcript_text")
_MEDIA_FIELD = {"media": {"type": "string", "format": "binary", "description": "Optional audio/video to play alongside the transcript"}}
_CREATE_BODY = {
    "required": True,
    "content": {
        "application/json": {"schema": MeetingCreateIn.model_json_schema()},
        "multipart/form-data": {
            "schema": {
                "type": "object",
                "properties": {
                    "file": {"type": "string", "format": "binary", "description": ".txt, .vtt, .srt or .json"},
                    **_MEDIA_FIELD,
                    **{k: v for k, v in MeetingCreateIn.model_json_schema()["properties"].items()
                       if k in _FORM_FIELDS},
                },
            }
        },
    },
}


@router.get("", response_model=Page[MeetingListItem])
def list_meetings(db: DbSession, user: CurrentUser, filters: Annotated[MeetingFilters, Query()]):
    meetings, total = meeting_query.list_meetings(db, user, filters)
    return Page[MeetingListItem](
        items=[MeetingListItem.model_validate(m) for m in meetings],
        total=total, page=filters.page, limit=filters.limit,
    )


@router.post(
    "", response_model=MeetingDetail, status_code=201, responses=ERROR_RESPONSES,
    openapi_extra={"requestBody": _CREATE_BODY},
)
async def create_meeting(
    request: Request, db: DbSession, user: CurrentUser, llm: Llm, background: BackgroundTasks, factory: SessionFactory,
):
    """Create a meeting from a pasted transcript (JSON) or an uploaded file (multipart)."""
    content: str | bytes | None = None
    filename: str | None = None
    media: UploadFile | None = None
    if request.headers.get("content-type", "").startswith(("multipart/form-data", "application/x-www-form-urlencoded")):
        form = await request.form()
        fields = {k: form[k] for k in _FORM_FIELDS if form.get(k) not in (None, "")}
        upload = form.get("file")
        if isinstance(upload, UploadFile):
            content, filename = await upload.read(MAX_BYTES + 1), upload.filename
        if isinstance(form.get("media"), UploadFile) and form["media"].filename:
            media = form["media"]
            media_service.validate_upload(media)  # reject before anything is created
        payload = MeetingCreateIn.model_validate(fields)
    else:
        payload = MeetingCreateIn.model_validate_json(await request.body())

    if content is not None and payload.transcript_text:
        raise ValidationFailed("Provide either a file or transcript_text, not both.")
    if content is None:
        content = payload.transcript_text
    if not content and media is not None:
        # A recording on its own: transcribe it (Whisper), then carry on as if a transcript had been uploaded
        data = await media.read()
        await media.seek(0)
        content = await run_in_threadpool(transcription_service.transcribe, data, media.filename or "recording", media.content_type)
        filename = f"{os.path.splitext(os.path.basename(media.filename or 'recording'))[0]}.vtt"
    if not content:
        raise ValidationFailed("Provide a transcript file, transcript_text, or a recording to transcribe.")

    meeting = meeting_service.create_meeting_from_transcript(
        db, user, content=content, filename=filename, fmt=payload.format,
        title=payload.title, started_at=payload.started_at, llm=llm,
    )
    if media is not None:
        rel, content_type = await media_service.save_media(media, user.id, meeting.id)
        meeting = meeting_service.attach_media(db, user, meeting.id, rel, content_type)
    background.add_task(notifications.on_meeting_created, factory, meeting.id)  # recap email + integrations
    return meeting


@router.get("/{meeting_id}", response_model=MeetingDetail, responses=ERROR_RESPONSES)
def get_meeting(meeting_id: int, db: DbSession, user: CurrentUser):
    return meeting_service.get_meeting(db, user, meeting_id)


@router.patch("/{meeting_id}", response_model=MeetingDetail, responses={**ERROR_RESPONSES, 409: {"description": "Participant conflict"}})
def update_meeting(meeting_id: int, body: MeetingUpdate, db: DbSession, user: CurrentUser):
    return meeting_service.update_meeting(db, user, meeting_id, body)


@router.delete("/{meeting_id}", status_code=204, responses=ERROR_RESPONSES)
def delete_meeting(meeting_id: int, db: DbSession, user: CurrentUser):
    meeting_service.delete_meeting(db, user, meeting_id)
    return Response(status_code=204)
