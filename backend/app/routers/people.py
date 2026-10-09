from fastapi import APIRouter

from app.deps import CurrentUser, DbSession
from app.schemas.people import PersonOut
from app.services import people_service

router = APIRouter(prefix="/api", tags=["people"])


@router.get("/people", response_model=list[PersonOut])
def list_people(db: DbSession, user: CurrentUser):
    return people_service.list_people(db, user)
