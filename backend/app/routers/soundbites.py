from fastapi import APIRouter, Response

from app.deps import CurrentUser, DbSession
from app.schemas.common import ERROR_RESPONSES
from app.schemas.soundbite import SoundbiteCreate, SoundbiteListOut, SoundbiteOut, SoundbiteUpdate
from app.services import soundbite_service

router = APIRouter(tags=["soundbites"])


@router.get("/api/meetings/{meeting_id}/soundbites", response_model=SoundbiteListOut, responses=ERROR_RESPONSES)
def list_soundbites(meeting_id: int, db: DbSession, user: CurrentUser):
    return SoundbiteListOut(items=soundbite_service.list_soundbites(db, user, meeting_id))


@router.post("/api/meetings/{meeting_id}/soundbites", response_model=SoundbiteOut, status_code=201, responses=ERROR_RESPONSES)
def create_soundbite(meeting_id: int, body: SoundbiteCreate, db: DbSession, user: CurrentUser):
    return soundbite_service.create_soundbite(db, user, meeting_id, body)


@router.patch("/api/soundbites/{soundbite_id}", response_model=SoundbiteOut, responses=ERROR_RESPONSES)
def update_soundbite(soundbite_id: int, body: SoundbiteUpdate, db: DbSession, user: CurrentUser):
    return soundbite_service.update_soundbite(db, user, soundbite_id, body)


@router.delete("/api/soundbites/{soundbite_id}", status_code=204, responses=ERROR_RESPONSES)
def delete_soundbite(soundbite_id: int, db: DbSession, user: CurrentUser):
    soundbite_service.delete_soundbite(db, user, soundbite_id)
    return Response(status_code=204)
