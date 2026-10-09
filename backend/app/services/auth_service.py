"""Accounts: sign up, log in (password, demo, Google), reset and change passwords, delete."""
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.errors import AppError, ValidationFailed
from app.models import Meeting, User
from app.schemas.auth import ChangePasswordIn, SignupIn
from app.security import (
    create_token, decode_claims, hash_password, password_fingerprint, verify_password,
)
from app.seed.seed import add_sample_meeting
from app.services import media_service
from app.services.people_service import get_default_user
from app.services.throttle import login_throttle

# Run when the given email has no usable password, so a miss costs the same as a hit
# (otherwise response time reveals which emails have accounts).
_DUMMY_HASH = hash_password("not-a-real-password")
INVALID_LOGIN = AppError(401, "invalid_credentials", "Incorrect email or password.")


def find_by_email(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(func.lower(User.email) == email.lower()))


def issue_token(user: User) -> str:
    return create_token(user.id)


def signup(db: Session, data: SignupIn) -> User:
    if find_by_email(db, data.email):
        raise AppError(409, "email_taken", "An account with this email already exists. Log in instead.")
    user = User(name=data.name, email=data.email, password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    add_sample_meeting(db, user)
    return user


def authenticate(db: Session, email: str, password: str, client_ip: str) -> User:
    key = f"{client_ip}|{email.lower()}"
    if login_throttle.blocked(key):
        raise AppError(429, "too_many_attempts", "Too many failed attempts. Try again in a few minutes.")
    user = find_by_email(db, email)
    ok = verify_password(password, user.password_hash if user else _DUMMY_HASH)
    if not user or not ok:
        login_throttle.record_failure(key)
        raise INVALID_LOGIN
    login_throttle.reset(key)
    return user


def demo_login(db: Session) -> User:
    if not settings.demo_login_enabled:
        raise AppError(403, "demo_disabled", "The demo account is turned off on this server.")
    return get_default_user(db)


def verify_google_credential(credential: str) -> dict:
    """Validate a Google Sign-In ID token with Google's tokeninfo endpoint."""
    if not settings.google_client_id:
        raise AppError(501, "google_not_configured", "Google sign-in is not set up on this server.")
    url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode({"id_token": credential})
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:  # noqa: S310 - fixed https URL
            claims = json.loads(resp.read())
    except (urllib.error.URLError, ValueError) as exc:
        raise AppError(401, "invalid_google_token", "Google sign-in failed. Try again.") from exc
    if claims.get("aud") != settings.google_client_id or claims.get("email_verified") not in (True, "true"):
        raise AppError(401, "invalid_google_token", "Google sign-in failed. Try again.")
    return claims


def google_login(db: Session, credential: str) -> tuple[User, bool]:
    """Returns (user, created). Links an existing account with the same verified email."""
    claims = verify_google_credential(credential)
    sub, email = claims["sub"], claims["email"].lower()
    user = db.scalar(select(User).where(User.google_sub == sub)) or find_by_email(db, email)
    created = user is None
    if user is None:
        user = User(name=claims.get("name") or email.split("@")[0], email=email, google_sub=sub, avatar_url=claims.get("picture"))
        db.add(user)
        db.commit()
        add_sample_meeting(db, user)
    elif user.google_sub is None:
        user.google_sub = sub
        db.commit()
    return user, created


def reset_token_for(user: User) -> str:
    return create_token(user.id, purpose="reset", expires=timedelta(hours=1), extra={"fp": password_fingerprint(user.password_hash)})


def reset_password(db: Session, token: str, new_password: str) -> User:
    claims = decode_claims(token, "reset")
    user = db.get(User, int(claims["sub"])) if claims else None
    if not user or claims.get("fp") != password_fingerprint(user.password_hash):
        raise AppError(400, "invalid_reset_token", "This reset link is invalid or has expired. Request a new one.")
    user.password_hash = hash_password(new_password)
    db.commit()
    return user


def change_password(db: Session, user: User, data: ChangePasswordIn) -> None:
    if user.password_hash and not verify_password(data.current_password, user.password_hash):
        raise AppError(400, "wrong_password", "Your current password is incorrect.")
    user.password_hash = hash_password(data.new_password)
    db.commit()


def update_profile(db: Session, user: User, *, name: str | None, avatar_url: str | None, fields: set[str]) -> User:
    if "name" in fields and name:
        user.name = " ".join(name.split())
    if "avatar_url" in fields:
        if avatar_url and not avatar_url.startswith("https://"):
            raise ValidationFailed("Avatar must be an https:// image URL.")
        user.avatar_url = avatar_url or None
    db.commit()
    return user


def delete_account(db: Session, user: User, password: str | None) -> None:
    if user.is_demo:
        raise AppError(403, "demo_protected", "The shared demo account can't be deleted.")
    if user.password_hash and not verify_password(password or "", user.password_hash):
        raise AppError(400, "wrong_password", "Your password is incorrect.")
    for rel in db.scalars(select(Meeting.media_path).where(Meeting.owner_id == user.id, Meeting.media_path.is_not(None))):
        media_service.delete_media(rel)
    db.delete(user)  # cascades to meetings, people, tags, keys, integrations and the email log
    db.commit()
