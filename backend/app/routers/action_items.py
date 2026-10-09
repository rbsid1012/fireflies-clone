from fastapi import APIRouter, Response

from app.deps import CurrentUser, DbSession
from app.schemas.action_item import ActionItemCreate, ActionItemOut, ActionItemUpdate
from app.schemas.common import ERROR_RESPONSES
from app.services import action_item_service

router = APIRouter(tags=["action items"])


@router.post("/api/meetings/{meeting_id}/action-items", response_model=ActionItemOut, status_code=201, responses=ERROR_RESPONSES)
def create_action_item(meeting_id: int, body: ActionItemCreate, db: DbSession, user: CurrentUser):
    return action_item_service.create_action_item(db, user, meeting_id, body)


@router.patch("/api/action-items/{item_id}", response_model=ActionItemOut, responses=ERROR_RESPONSES)
def update_action_item(item_id: int, body: ActionItemUpdate, db: DbSession, user: CurrentUser):
    return action_item_service.update_action_item(db, user, item_id, body)


@router.delete("/api/action-items/{item_id}", status_code=204, responses=ERROR_RESPONSES)
def delete_action_item(item_id: int, db: DbSession, user: CurrentUser):
    action_item_service.delete_action_item(db, user, item_id)
    return Response(status_code=204)
