"""Passwords, tokens, API keys and signed links. Standard library plus PyJWT; no custom crypto."""
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings

# scrypt parameters (N=2^14, r=8, p=1) are the interactive-login defaults recommended by OWASP's
# guidance for scrypt; memory use is ~16 MiB per hash.
_SCRYPT = {"n": 2**14, "r": 8, "p": 1, "maxmem": 64 * 1024 * 1024}
API_KEY_PREFIX = "ffk_"


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, dklen=32, **_SCRYPT)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        scheme, salt_hex, digest_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        candidate = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt_hex), dklen=32, **_SCRYPT)
        return hmac.compare_digest(candidate, bytes.fromhex(digest_hex))
    except (ValueError, TypeError):
        return False


def create_token(
    user_id: int, *, purpose: str = "access", expires: timedelta | None = None, extra: dict | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    exp = expires or timedelta(days=settings.token_expire_days)
    payload = {**(extra or {}), "sub": str(user_id), "purpose": purpose, "iat": now, "exp": now + exp}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_claims(token: str, purpose: str = "access") -> dict | None:
    """Claims of a valid, unexpired token issued for this purpose, else None."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"], options={"require": ["exp", "sub"]})
    except jwt.PyJWTError:
        return None
    return payload if payload.get("purpose") == purpose else None


def decode_token(token: str, purpose: str = "access") -> int | None:
    """The user id a valid, unexpired token of this purpose was issued to, else None."""
    payload = decode_claims(token, purpose)
    try:
        return int(payload["sub"]) if payload else None
    except (KeyError, ValueError):
        return None


def password_fingerprint(password_hash: str | None) -> str:
    """Ties a reset token to the password it was issued for, so it dies once the password changes."""
    return hashlib.sha256((password_hash or "").encode()).hexdigest()[:12]


def generate_api_key() -> tuple[str, str, str]:
    """Return (full key, display prefix, sha256 hex). The full key is shown to the user once."""
    key = API_KEY_PREFIX + secrets.token_urlsafe(32)
    return key, key[:12], hash_api_key(key)


def hash_api_key(key: str) -> str:
    # API keys are high-entropy random strings, so a fast hash is appropriate (unlike passwords)
    return hashlib.sha256(key.encode()).hexdigest()


def sign_media(meeting_id: int) -> str:
    """Unforgeable token for a meeting's media URL (an <audio> element can't send auth headers)."""
    mac = hmac.new(settings.secret_key.encode(), f"media:{meeting_id}".encode(), hashlib.sha256)
    return mac.hexdigest()[:32]


def verify_media_sig(meeting_id: int, sig: str) -> bool:
    return hmac.compare_digest(sign_media(meeting_id), sig)
