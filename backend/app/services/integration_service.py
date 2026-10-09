"""Outbound integrations: a Slack incoming webhook and a generic signed webhook.

Both are real: when a meeting finishes processing we POST a summary to the configured URL. The URL is
supplied by the user, so it is validated against SSRF (https only; no private, loopback or link-local
addresses) before every request and redirects are never followed.
"""
import hashlib
import hmac
import ipaddress
import json
import logging
import secrets
import socket
import urllib.error
import urllib.request
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.errors import AppError, NotFoundError, ValidationFailed
from app.models import Integration, User
from app.models.base import utcnow

log = logging.getLogger(__name__)

KINDS = {"slack", "webhook"}
MAX_INTEGRATIONS = 10
EVENT = "meeting.completed"


def resolve_host(host: str) -> list[str]:
    """Indirection so tests can run without DNS."""
    return [info[4][0] for info in socket.getaddrinfo(host, None)]


def validate_webhook_url(url: str) -> str:
    parsed = urlparse(url.strip())
    insecure_ok = settings.allow_insecure_webhooks
    if parsed.scheme != "https" and not (insecure_ok and parsed.scheme == "http"):
        raise ValidationFailed("Webhook URLs must start with https://", "invalid_webhook_url")
    if not parsed.hostname or parsed.username or parsed.password:
        raise ValidationFailed("That doesn't look like a valid webhook URL.", "invalid_webhook_url")
    try:
        addresses = resolve_host(parsed.hostname)
    except OSError as exc:
        raise ValidationFailed(f"Could not resolve {parsed.hostname}.", "invalid_webhook_url") from exc
    for addr in addresses:
        ip = ipaddress.ip_address(addr.split("%")[0])
        if (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified) and not insecure_ok:
            raise ValidationFailed("That address points to a private network, which isn't allowed.", "invalid_webhook_url")
    return parsed.geturl()


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # noqa: D401 - a redirect could point inside our network
        return None


def _post(url: str, body: bytes, headers: dict[str, str], timeout: float = 8.0) -> int:
    opener = urllib.request.build_opener(_NoRedirect)
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json", **headers})
    try:
        with opener.open(req, timeout=timeout) as resp:
            return resp.status
    except urllib.error.HTTPError as exc:
        return exc.code


def list_integrations(db: Session, user: User) -> list[Integration]:
    return list(db.scalars(select(Integration).where(Integration.user_id == user.id).order_by(Integration.created_at)))


def _get(db: Session, user: User, integration_id: int) -> Integration:
    row = db.scalar(select(Integration).where(Integration.id == integration_id, Integration.user_id == user.id))
    if row is None:
        raise NotFoundError("Integration")
    return row


def create_integration(db: Session, user: User, kind: str, name: str, url: str) -> Integration:
    if kind not in KINDS:
        raise ValidationFailed(f"Unsupported integration '{kind}'.", "unsupported_integration")
    if len(list_integrations(db, user)) >= MAX_INTEGRATIONS:
        raise AppError(409, "too_many_integrations", f"You can connect at most {MAX_INTEGRATIONS} integrations.")
    clean_url = validate_webhook_url(url)
    if kind == "slack" and urlparse(clean_url).hostname not in ("hooks.slack.com",) and not settings.allow_insecure_webhooks:
        raise ValidationFailed("Slack webhook URLs look like https://hooks.slack.com/services/…", "invalid_webhook_url")
    config = {"url": clean_url}
    if kind == "webhook":
        config["secret"] = secrets.token_urlsafe(24)  # used to sign every delivery
    row = Integration(user_id=user.id, kind=kind, name=name, config=config)
    db.add(row)
    db.commit()
    return row


def update_integration(db: Session, user: User, integration_id: int, *, name: str | None, enabled: bool | None) -> Integration:
    row = _get(db, user, integration_id)
    if name is not None:
        row.name = name
    if enabled is not None:
        row.enabled = enabled
    db.commit()
    return row


def delete_integration(db: Session, user: User, integration_id: int) -> None:
    db.delete(_get(db, user, integration_id))
    db.commit()


def build_payload(integration: Integration, *, title: str, url: str, overview: str, action_items: list[str], sample: bool = False) -> tuple[bytes, dict[str, str]]:
    headers: dict[str, str] = {}
    if integration.kind == "slack":
        lines = [f"*<{url}|{title}>* is ready"] + ([overview] if overview else [])
        if action_items:
            lines += ["*Action items*", *[f"• {a}" for a in action_items[:8]]]
        body = json.dumps({"text": ("[Test] " if sample else "") + "\n".join(lines)}).encode()
    else:
        body = json.dumps({
            "event": EVENT, "test": sample,
            "meeting": {"title": title, "url": url, "overview": overview, "action_items": action_items},
        }).encode()
        secret = integration.config.get("secret", "")
        headers["X-Signature"] = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        headers["X-Event"] = EVENT
    return body, headers


def deliver(db: Session, integration: Integration, **payload) -> str:
    """POST one delivery and record the outcome. Never raises."""
    try:
        url = validate_webhook_url(integration.config["url"])  # re-checked: DNS can change after creation
        body, headers = build_payload(integration, **payload)
        status = _post(url, body, headers)
        result = "ok" if 200 <= status < 300 else f"HTTP {status}"
    except Exception as exc:  # noqa: BLE001
        log.warning("Integration %s delivery failed: %s", integration.id, exc)
        result = f"failed: {str(exc)[:150]}"
    integration.last_status = result
    integration.last_run_at = utcnow()
    db.commit()
    return result


def send_test(db: Session, user: User, integration_id: int) -> str:
    integration = _get(db, user, integration_id)
    return deliver(
        db, integration, title="Test meeting", url=settings.frontend_url,
        overview="This is a test delivery from your integration settings.", action_items=["Check that this message arrived"], sample=True,
    )


def dispatch(db: Session, user: User, *, title: str, url: str, overview: str, action_items: list[str]) -> None:
    for integration in list_integrations(db, user):
        if integration.enabled:
            deliver(db, integration, title=title, url=url, overview=overview, action_items=action_items)
