"""Sending email. Three interchangeable transports; every attempt is recorded in `email_log`.

Sending must never break the request that triggered it, so failures are logged and stored, not raised.
"""
import json
import logging
import smtplib
import urllib.error
import urllib.request
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import parseaddr
from typing import Protocol

from sqlalchemy.orm import Session

from app.config import settings
from app.models import EmailLog

log = logging.getLogger(__name__)


@dataclass
class OutboundEmail:
    to: str
    subject: str
    html: str
    text: str


class Transport(Protocol):
    name: str

    def send(self, msg: OutboundEmail) -> None: ...


class LogTransport:
    """No provider configured: the message is only recorded (visible in Settings, Email notifications)."""

    name = "log"

    def send(self, msg: OutboundEmail) -> None:
        log.info("[email not sent: no SMTP/Resend configured] to=%s subject=%s", msg.to, msg.subject)


class SmtpTransport:
    name = "smtp"

    def send(self, msg: OutboundEmail) -> None:
        message = EmailMessage()
        message["From"] = settings.email_from
        message["To"] = msg.to
        message["Subject"] = msg.subject
        message.set_content(msg.text)
        message.add_alternative(msg.html, subtype="html")
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_starttls:
                smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password or "")
            smtp.send_message(message)


class ResendTransport:
    name = "resend"

    def send(self, msg: OutboundEmail) -> None:
        body = json.dumps({
            "from": settings.email_from, "to": [msg.to], "subject": msg.subject, "html": msg.html, "text": msg.text,
        }).encode()
        req = urllib.request.Request(
            "https://api.resend.com/emails", data=body, method="POST",
            headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
        )
        try:
            urllib.request.urlopen(req, timeout=15).read()
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"Resend rejected the message ({exc.code}): {exc.read()[:200].decode(errors='replace')}") from exc


def get_transport() -> Transport:
    return {"smtp": SmtpTransport, "resend": ResendTransport}.get(settings.email_transport, LogTransport)()


def send_email(
    db: Session, *, user_id: int, msg: OutboundEmail, meeting_id: int | None = None, transport: Transport | None = None,
) -> EmailLog:
    transport = transport or get_transport()
    status, error = ("logged" if transport.name == "log" else "sent"), None
    try:
        # A header-injection guard: addresses must be a single plain address
        if "\n" in msg.to or "\r" in msg.to or not parseaddr(msg.to)[1]:
            raise ValueError("invalid recipient address")
        transport.send(msg)
    except Exception as exc:  # noqa: BLE001 - any provider failure is recorded, never raised
        log.warning("Email to %s failed: %s", msg.to, exc)
        status, error = "failed", str(exc)[:500]
    row = EmailLog(
        user_id=user_id, meeting_id=meeting_id, to_email=msg.to[:255], subject=msg.subject[:300],
        html=msg.html, text=msg.text, transport=transport.name, status=status, error=error,
    )
    db.add(row)
    db.commit()
    return row
