from fastapi import APIRouter, Response

from app.deps import CurrentUser, DbSession
from app.schemas.common import ERROR_RESPONSES
from app.schemas.people import TagCreate, TagOut
from app.services import meeting_service, people_service

router = APIRouter(prefix="/api/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
def list_tags(db: DbSession, user: CurrentUser):
    return people_service.list_tags(db, user)


@router.post("", response_model=TagOut, status_code=201, responses=ERROR_RESPONSES)
def create_tag(body: TagCreate, db: DbSession, user: CurrentUser):
    """Create a channel (tag) ahead of time; meetings are added to it from their edit dialog."""
    return meeting_service.create_tag(db, user, body.name)


@router.delete("/{tag_id}", status_code=204, responses=ERROR_RESPONSES)
def delete_tag(tag_id: int, db: DbSession, user: CurrentUser):
    people_service.delete_tag(db, user, tag_id)
    return Response(status_code=204)
