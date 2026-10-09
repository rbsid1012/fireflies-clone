from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.errors import NotFoundError
from app.models import EmailLog
from app.schemas.account import EmailLogDetail, EmailLogOut, SecurityOverview
from app.schemas.common import ERROR_RESPONSES
from app.schemas.settings import UserSettings, UserSettingsPatch
from app.services import email_service, email_templates, retention_service, security_service, settings_service

router = APIRouter(prefix="/api", tags=["settings"])


@router.get("/settings", response_model=UserSettings)
def get_settings(user: CurrentUser):
    return settings_service.get_settings(user)


@router.patch("/settings", response_model=UserSettings, responses=ERROR_RESPONSES)
def update_settings(body: UserSettingsPatch, db: DbSession, user: CurrentUser):
    """Partial update: send only the sections (and fields) that changed."""
    updated = settings_service.update_settings(db, user, body)
    if body.recording is not None:
        retention_service.purge_expired(db, user)  # a new retention rule takes effect immediately
    return updated


@router.get("/settings/security", response_model=SecurityOverview)
def security_overview(db: DbSession, user: CurrentUser):
    return security_service.overview(db, user)


@router.post("/settings/email/test", response_model=EmailLogOut, status_code=201)
def send_test_email(db: DbSession, user: CurrentUser):
    """Send a test message to your own address with whatever provider the server is configured for."""
    rendered = email_templates.test_email(name=user.name)
    return email_service.send_email(
        db, user_id=user.id, msg=email_service.OutboundEmail(to=user.email, subject=rendered.subject, html=rendered.html, text=rendered.text)
    )


@router.get("/emails", response_model=list[EmailLogOut])
def list_emails(db: DbSession, user: CurrentUser, limit: Annotated[int, Query(ge=1, le=100)] = 20):
    """Recent emails the app sent (or would have sent) for you."""
    return list(db.scalars(select(EmailLog).where(EmailLog.user_id == user.id).order_by(EmailLog.id.desc()).limit(limit)))


@router.get("/emails/{email_id}", response_model=EmailLogDetail, responses=ERROR_RESPONSES)
def get_email(email_id: int, db: DbSession, user: CurrentUser):
    row = db.scalar(select(EmailLog).where(EmailLog.id == email_id, EmailLog.user_id == user.id))
    if row is None:
        raise NotFoundError("Email")
    return row

