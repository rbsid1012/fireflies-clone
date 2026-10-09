from fastapi import APIRouter, Response

from app.deps import CurrentUser, DbSession
from app.schemas.auth import ChangePasswordIn, DeleteAccountIn, MessageOut, ProfileUpdate
from app.schemas.common import ERROR_RESPONSES
from app.schemas.people import UserOut
from app.services import auth_service

router = APIRouter(prefix="/api/me", tags=["account"])


@router.get("", response_model=UserOut)
def me(user: CurrentUser):
    return user


@router.patch("", response_model=UserOut, responses=ERROR_RESPONSES)
def update_profile(body: ProfileUpdate, db: DbSession, user: CurrentUser):
    return auth_service.update_profile(db, user, name=body.name, avatar_url=body.avatar_url, fields=body.model_fields_set)


@router.post("/password", response_model=MessageOut, responses=ERROR_RESPONSES)
def change_password(body: ChangePasswordIn, db: DbSession, user: CurrentUser):
    auth_service.change_password(db, user, body)
    return MessageOut(message="Password updated.")


@router.delete("", status_code=204, responses=ERROR_RESPONSES)
def delete_account(body: DeleteAccountIn, db: DbSession, user: CurrentUser):
    """Permanently deletes the account and everything in it."""
    auth_service.delete_account(db, user, body.password)
    return Response(status_code=204)
