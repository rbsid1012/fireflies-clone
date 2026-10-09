"""Transactional email content. HTML is table-based with inline styles (what mail clients support).
Everything interpolated into HTML is escaped: meeting titles and summaries come from user data."""
from dataclasses import dataclass
from datetime import datetime
from html import escape

from app.services import email_recap

BRAND = "#623ae6"


@dataclass
class Rendered:
    subject: str
    html: str
    text: str


def _shell(preheader: str, body: str, footer: str) -> str:
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#f3f3f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#16161a;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">{escape(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f6;padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="padding:28px 32px 8px 32px;text-align:center;">
  <table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:bottom;"><div style="width:6px;height:12px;background:#c5265f;border-radius:3px;"></div></td><td width="3"></td>
    <td style="vertical-align:bottom;"><div style="width:6px;height:20px;background:#9b3fb5;border-radius:3px;"></div></td><td width="3"></td>
    <td style="vertical-align:bottom;"><div style="width:6px;height:28px;background:{BRAND};border-radius:3px;"></div></td>
    <td width="10"></td><td style="font-size:20px;font-weight:600;color:#16161a;">Fireflies Clone</td>
  </tr></table>
</td></tr>
<tr><td style="padding:16px 32px 32px 32px;">{body}</td></tr>
</table>
<p style="max-width:520px;margin:18px auto 0 auto;font-size:12px;line-height:18px;color:#8a8a93;text-align:center;">{footer}</p>
</td></tr></table></body></html>"""


def _button(label: str, url: str, primary: bool = True) -> str:
    bg, fg = (BRAND, "#ffffff") if primary else ("#efeefb", BRAND)
    return (
        f'<a href="{escape(url, quote=True)}" style="display:inline-block;padding:13px 22px;margin:4px;'
        f'background:{bg};color:{fg};border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;">{escape(label)}</a>'
    )


def _when(started_at: datetime) -> str:
    return f"{started_at:%b} {started_at.day}, {started_at:%Y} at {started_at:%-I:%M %p} UTC"


def recap_email(
    *, recipient_name: str, owner_name: str, owner_email: str, title: str, started_at: datetime,
    overview: str, action_items: list[str], include: str, url: str, settings_url: str, notice: str = "",
    details: email_recap.Details | None = None,
) -> Rendered:
    """'Your meeting recap': the email sent whenever a meeting finishes processing (layout in email_recap.py)."""
    show_actions = bool(include in ("overview_actions", "full") and action_items)
    args = dict(owner_name=owner_name, owner_email=owner_email, title=title, started_at=started_at, overview=overview,
                action_items=action_items, show_actions=show_actions, url=url, notice=notice, details=details)
    return Rendered(f"Your meeting recap - {title}", email_recap.recap_html(settings_url=settings_url, **args), email_recap.recap_text(**args))


def welcome_email(*, name: str, url: str) -> Rendered:
    body = (
        f'<h1 style="margin:8px 0 8px 0;text-align:center;font-size:24px;">Welcome aboard, {escape(name)}!</h1>'
        '<p style="margin:0 0 22px 0;text-align:center;font-size:15px;line-height:23px;color:#55555d;">'
        'Upload a transcript or paste one in and you get a summary, an outline and action items in seconds. '
        'We added a sample meeting so you can look around first.</p>'
        f'<div style="text-align:center;">{_button("Open my meetings", url)}</div>'
    )
    return Rendered("Welcome to Fireflies Clone", _shell("Your account is ready", body, "You are receiving this because you created an account."),
                    f"Welcome aboard, {name}!\n\nOpen your meetings: {url}")


def reset_password_email(*, name: str, url: str) -> Rendered:
    body = (
        f'<h1 style="margin:8px 0 8px 0;text-align:center;font-size:22px;">Reset your password</h1>'
        f'<p style="margin:0 0 22px 0;text-align:center;font-size:15px;line-height:23px;color:#55555d;">Hi {escape(name)}, use the button below '
        'to choose a new password. The link works for one hour.</p>'
        f'<div style="text-align:center;">{_button("Choose a new password", url)}</div>'
        '<p style="margin:22px 0 0 0;text-align:center;font-size:13px;color:#8a8a93;">If you did not ask for this, you can ignore this email.</p>'
    )
    return Rendered("Reset your password", _shell("Reset your password", body, "Someone asked to reset the password for this address."),
                    f"Hi {name},\n\nChoose a new password (valid for one hour): {url}\n\nIf you did not ask for this, ignore this email.")


def test_email(*, name: str) -> Rendered:
    body = (
        f'<h1 style="margin:8px 0 8px 0;text-align:center;font-size:22px;">It works, {escape(name)}</h1>'
        '<p style="margin:0;text-align:center;font-size:15px;line-height:23px;color:#55555d;">This is a test message from your notification settings.</p>'
    )
    return Rendered("Test email from Fireflies Clone", _shell("Test message", body, "Sent from Settings, Email notifications."),
                    f"It works, {name}. This is a test message from your notification settings.")
