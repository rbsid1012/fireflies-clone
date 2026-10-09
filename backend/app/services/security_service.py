"""The 'Security overview' checklist from Settings."""
from datetime import timedelta

from sqlalchemy.orm import Session

from app.models import User
from app.models.base import utcnow
from app.schemas.account import SecurityCheck, SecurityOverview
from app.services import api_key_service
from app.services.settings_service import get_settings


def overview(db: Session, user: User) -> SecurityOverview:
    cfg = get_settings(user)
    stale = [
        k for k in api_key_service.list_keys(db, user)
        if (k.last_used_at or k.created_at) < utcnow() - timedelta(days=30)
    ]
    checks = [
        SecurityCheck(
            id="sign_in", label="Protected sign-in", done=bool(user.password_hash or user.google_sub),
            detail="Your account has a password or Google sign-in." if (user.password_hash or user.google_sub)
            else "Add a password so the account can't be opened without credentials.",
        ),
        SecurityCheck(
            id="retention", label="Automatic deletion", done=cfg.recording.auto_delete_days is not None,
            detail="Old meetings are deleted automatically." if cfg.recording.auto_delete_days
            else "Choose how long meetings are kept under Recording & Privacy.",
        ),
        SecurityCheck(
            id="api_keys", label="No stale API keys", done=not stale,
            detail="Every API key was used in the last 30 days (or you have none)." if not stale
            else f"{len(stale)} API key(s) unused for 30+ days. Delete keys you no longer need.",
        ),
    ]
    done = sum(c.done for c in checks)
    return SecurityOverview(done=done, total=len(checks), checks=checks)
