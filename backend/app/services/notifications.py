"""What happens after a meeting is created: recap emails and integration deliveries.

Runs as a background task with its own database session, after the response was sent.
"""
import logging
from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Meeting, MeetingStatus, User
from app.services import email_service, email_templates, integration_service
from app.services.meeting_service import get_meeting
from app.services.settings_service import get_settings

log = logging.getLogger(__name__)


def meeting_url(meeting_id: int) -> str:
    return f"{settings.frontend_url.rstrip('/')}/meetings/{meeting_id}"


def recap_recipients(meeting: Meeting, user: User, mode: str) -> list[tuple[str, str]]:
    """(name, email) pairs for the user's recap setting. Participants without an email are skipped."""
    if mode == "none":
        return []
    recipients = {user.email.lower(): user.name}
    if mode == "participants":
        for p in meeting.participants:
            if p.email:
                recipients.setdefault(p.email.lower(), p.name)
    return [(name, email) for email, name in recipients.items()]


def on_meeting_created(factory: Callable[[], Session], meeting_id: int) -> None:
    try:
        with factory() as db:
            _notify(db, meeting_id)
    except Exception:  # noqa: BLE001 - a notification problem must never surface as an error
        log.exception("Post-processing notifications failed for meeting %s", meeting_id)


def _notify(db: Session, meeting_id: int) -> None:
    owner_id = db.scalar(select(Meeting.owner_id).where(Meeting.id == meeting_id))
    user = db.get(User, owner_id) if owner_id else None
    if user is None:
        return
    meeting = get_meeting(db, user, meeting_id)
    if meeting.status != MeetingStatus.ready:
        return

    cfg = get_settings(user).email
    overview = meeting.summary.overview if meeting.summary else ""
    open_items = [a.text for a in meeting.action_items if not a.is_completed]
    url = meeting_url(meeting.id)

    compliance = get_settings(user).compliance
    for name, address in recap_recipients(meeting, user, cfg.recap_recipients):
        rendered = email_templates.recap_email(
            recipient_name=name, owner_name=user.name, owner_email=user.email, title=meeting.title,
            started_at=meeting.started_at, overview=overview, action_items=open_items, include=cfg.recap_include,
            url=url, settings_url=f"{settings.frontend_url.rstrip('/')}/settings/recording-privacy",
            # Only people other than the owner are told the meeting was recorded
            notice=compliance.announcement if compliance.notify_participants and address.lower() != user.email.lower() else "",
        )
        email_service.send_email(
            db, user_id=user.id, meeting_id=meeting.id,
            msg=email_service.OutboundEmail(to=address, subject=rendered.subject, html=rendered.html, text=rendered.text),
        )
    integration_service.dispatch(db, user, title=meeting.title, url=url, overview=overview, action_items=open_items)


def _send_to_user(factory: Callable[[], Session], user_id: int, build) -> None:
    try:
        with factory() as db:
            user = db.get(User, user_id)
            if user is None:
                return
            rendered = build(user)
            email_service.send_email(
                db, user_id=user.id,
                msg=email_service.OutboundEmail(to=user.email, subject=rendered.subject, html=rendered.html, text=rendered.text),
            )
    except Exception:  # noqa: BLE001
        log.exception("Sending account email failed for user %s", user_id)


def send_welcome(factory: Callable[[], Session], user_id: int) -> None:
    _send_to_user(factory, user_id, lambda u: email_templates.welcome_email(name=u.name, url=f"{settings.frontend_url.rstrip('/')}/meetings"))


def send_password_reset(factory: Callable[[], Session], user_id: int, token: str) -> None:
    url = f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}"
    _send_to_user(factory, user_id, lambda u: email_templates.reset_password_email(name=u.name, url=url))
