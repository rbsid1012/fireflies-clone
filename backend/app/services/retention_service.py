"""Auto-delete: remove meetings older than the user's retention setting."""
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Meeting, User
from app.models.base import utcnow
from app.services import media_service
from app.services.settings_service import get_settings


def purge_expired(db: Session, user: User) -> int:
    days = get_settings(user).recording.auto_delete_days
    if not days:
        return 0
    expired = list(db.scalars(select(Meeting).where(Meeting.owner_id == user.id, Meeting.started_at < utcnow() - timedelta(days=days))))
    for meeting in expired:
        media_service.delete_media(meeting.media_path)
        db.delete(meeting)
    if expired:
        db.commit()
    return len(expired)


def purge_all(db: Session) -> int:
    """Apply every user's retention rule (run at startup so rules hold even if nobody logs in)."""
    return sum(purge_expired(db, user) for user in db.scalars(select(User)))
