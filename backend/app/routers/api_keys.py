from fastapi import APIRouter, Response

from app.deps import CurrentUser, DbSession
from app.schemas.account import ApiKeyCreate, ApiKeyCreated, ApiKeyOut
from app.schemas.common import ERROR_RESPONSES
from app.services import api_key_service

router = APIRouter(prefix="/api/api-keys", tags=["api keys"])


@router.get("", response_model=list[ApiKeyOut])
def list_keys(db: DbSession, user: CurrentUser):
    return api_key_service.list_keys(db, user)


@router.post("", response_model=ApiKeyCreated, status_code=201, responses=ERROR_RESPONSES)
def create_key(body: ApiKeyCreate, db: DbSession, user: CurrentUser):
    """The full key is in this response only. Use it as `Authorization: Bearer ffk_…`."""
    row, key = api_key_service.create_key(db, user, " ".join(body.name.split()))
    return ApiKeyCreated(id=row.id, name=row.name, prefix=row.prefix, created_at=row.created_at, last_used_at=None, key=key)


@router.delete("/{key_id}", status_code=204, responses=ERROR_RESPONSES)
def delete_key(key_id: int, db: DbSession, user: CurrentUser):
    api_key_service.delete_key(db, user, key_id)
    return Response(status_code=204)
