from collections.abc import Callable
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import SessionLocal, get_db
from app.errors import AppError
from app.models import User
from app.security import API_KEY_PREFIX, decode_token
from app.services import api_key_service
from app.services.llm_client import LLMClient, get_llm_client

DbSession = Annotated[Session, Depends(get_db)]

# Shows the "Authorize" button in /docs; auto_error is off so we can return our own error shape
_bearer = HTTPBearer(auto_error=False, description="A login token, or a personal API key (ffk_…)")


def current_user(db: DbSession, creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]) -> User:
    if creds is None:
        raise AppError(401, "not_authenticated", "Log in to continue.")
    token = creds.credentials
    if token.startswith(API_KEY_PREFIX):
        user = api_key_service.authenticate(db, token)
    else:
        user_id = decode_token(token)
        user = db.get(User, user_id) if user_id else None
    if user is None:
        raise AppError(401, "invalid_token", "Your session has expired. Log in again.")
    return user


CurrentUser = Annotated[User, Depends(current_user)]


def llm() -> LLMClient | None:
    """None when LLM_API_KEY is unset. Overridden in tests."""
    return get_llm_client()


Llm = Annotated[LLMClient | None, Depends(llm)]


def session_factory() -> Callable[[], Session]:
    """Used by background tasks, which outlive the request's session. Overridden in tests."""
    return SessionLocal


SessionFactory = Annotated[Callable[[], Session], Depends(session_factory)]
