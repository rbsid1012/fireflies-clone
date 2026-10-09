from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppError, NotFoundError
from app.models import ApiKey, User
from app.models.base import utcnow
from app.security import API_KEY_PREFIX, generate_api_key, hash_api_key

MAX_KEYS = 10


def list_keys(db: Session, user: User) -> list[ApiKey]:
    return list(db.scalars(select(ApiKey).where(ApiKey.user_id == user.id).order_by(ApiKey.created_at.desc())))


def create_key(db: Session, user: User, name: str) -> tuple[ApiKey, str]:
    """Returns the stored row and the full key, which is shown once and never stored."""
    if len(list_keys(db, user)) >= MAX_KEYS:
        raise AppError(409, "too_many_keys", f"You can have at most {MAX_KEYS} API keys. Delete one first.")
    key, prefix, key_hash = generate_api_key()
    row = ApiKey(user_id=user.id, name=name, prefix=prefix, key_hash=key_hash)
    db.add(row)
    db.commit()
    return row, key


def delete_key(db: Session, user: User, key_id: int) -> None:
    row = db.scalar(select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user.id))
    if row is None:
        raise NotFoundError("API key")
    db.delete(row)
    db.commit()


def authenticate(db: Session, key: str) -> User | None:
    if not key.startswith(API_KEY_PREFIX):
        return None
    row = db.scalar(select(ApiKey).where(ApiKey.key_hash == hash_api_key(key)))
    if row is None:
        return None
    if row.last_used_at is None or utcnow() - row.last_used_at > timedelta(minutes=5):
        row.last_used_at = utcnow()  # coarse on purpose: avoids a write on every request
        db.commit()
    return db.get(User, row.user_id)
