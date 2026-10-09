from fastapi import APIRouter, BackgroundTasks, Request

from app.config import settings
from app.deps import DbSession, SessionFactory
from app.schemas.auth import (
    AuthConfigOut, AuthOut, ForgotPasswordIn, GoogleIn, LoginIn, MessageOut, ResetPasswordIn, SignupIn,
)
from app.schemas.common import ERROR_RESPONSES
from app.schemas.people import UserOut
from app.services import auth_service, notifications, retention_service, transcription_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _session(db, user) -> AuthOut:
    retention_service.purge_expired(db, user)
    return AuthOut(token=auth_service.issue_token(user), user=UserOut.model_validate(user))


@router.get("/config", response_model=AuthConfigOut)
def auth_config():
    """What the login screen can offer on this server."""
    return AuthConfigOut(
        google_client_id=settings.google_client_id, demo_login_enabled=settings.demo_login_enabled,
        email_transport=settings.email_transport, ai_model=settings.llm_model if settings.llm_api_key else None,
        can_transcribe=transcription_service.available(),
    )


@router.post("/signup", response_model=AuthOut, status_code=201, responses=ERROR_RESPONSES)
def signup(body: SignupIn, db: DbSession, background: BackgroundTasks, factory: SessionFactory):
    user = auth_service.signup(db, body)
    background.add_task(notifications.send_welcome, factory, user.id)
    return _session(db, user)


@router.post("/login", response_model=AuthOut, responses=ERROR_RESPONSES)
def login(body: LoginIn, request: Request, db: DbSession):
    user = auth_service.authenticate(db, body.email, body.password, request.client.host if request.client else "unknown")
    return _session(db, user)


@router.post("/demo", response_model=AuthOut, responses=ERROR_RESPONSES)
def demo(db: DbSession):
    """Log in to the shared, pre-filled demo account with no password."""
    return _session(db, auth_service.demo_login(db))


@router.post("/google", response_model=AuthOut, responses=ERROR_RESPONSES)
def google(body: GoogleIn, db: DbSession, background: BackgroundTasks, factory: SessionFactory):
    user, created = auth_service.google_login(db, body.credential)
    if created:
        background.add_task(notifications.send_welcome, factory, user.id)
    return _session(db, user)


@router.post("/forgot-password", response_model=MessageOut)
def forgot_password(body: ForgotPasswordIn, db: DbSession, background: BackgroundTasks, factory: SessionFactory):
    """Always answers the same way, so it can't be used to discover which emails have accounts."""
    user = auth_service.find_by_email(db, body.email)
    if user is not None and not user.is_demo:
        background.add_task(notifications.send_password_reset, factory, user.id, auth_service.reset_token_for(user))
    return MessageOut(message="If an account exists for that email, a reset link is on its way.")


@router.post("/reset-password", response_model=AuthOut, responses=ERROR_RESPONSES)
def reset_password(body: ResetPasswordIn, db: DbSession):
    return _session(db, auth_service.reset_password(db, body.token, body.password))
