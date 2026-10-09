"""The 'Your meeting recap' email, laid out like a product notification: illustration, who added the meeting,
the meeting card, two buttons, a promo band, then the footer. Table-based HTML with inline styles, since that is
what mail clients support. Everything interpolated is escaped: titles and summaries come from user data."""
from dataclasses import dataclass, field
from datetime import datetime
from html import escape

BRAND = "#6b6ff5"
INK = "#16161a"
MUTED = "#6b6b73"


@dataclass
class Details:
    """What the meeting contained. Any part left empty is simply not shown."""

    questions: int = 0
    action_items_total: int = 0
    dates: int = 0
    keywords: list[str] = field(default_factory=list)
    bullets: list[str] = field(default_factory=list)


def _ordinal(n: int) -> str:
    return f"{n}{'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def when(started_at: datetime) -> str:
    return f"{started_at:%b} {_ordinal(started_at.day)} at {started_at:%-I:%M %p} UTC"


def _bars(scale: float = 1.0) -> str:
    """The three-bar mark, drawn with table cells (images are often blocked by default)."""
    cells = [("#c5265f", 12), ("#9b3fb5", 20), (BRAND, 28)]
    parts = [
        f'<td style="vertical-align:bottom;"><div style="width:{round(6 * scale)}px;height:{round(h * scale)}px;background:{c};border-radius:{round(3 * scale)}px;"></div></td>'
        for c, h in cells
    ]
    return f'<table role="presentation" align="center" cellpadding="0" cellspacing="{round(3 * scale)}"><tr>{"".join(parts)}</tr></table>'


def _button(label: str, url: str, primary: bool) -> str:
    bg, fg = (BRAND, "#ffffff") if primary else ("#f3f4ff", BRAND)
    return (
        f'<td width="50%" style="padding:0 6px;"><a href="{escape(url, quote=True)}" style="display:block;background:{bg};color:{fg};'
        f'border-radius:8px;text-align:center;padding:18px 8px;font-size:18px;text-decoration:none;">{escape(label)}</a></td>'
    )


def _section(heading: str, inner: str) -> str:
    return (
        f'<tr><td style="padding:22px 44px 0 44px;"><div style="font-size:16px;font-weight:600;color:{INK};margin-bottom:6px;">{heading}</div>{inner}</td></tr>'
    )


def _tile(count: int, label: str, bg: str, fg: str) -> str:
    return (
        f'<td width="33%" style="padding:0 5px;"><div style="background:{bg};color:{fg};border-radius:8px;text-align:center;'
        f'padding:16px 6px;font-size:15px;line-height:21px;font-weight:600;">{count} {escape(label)}</div></td>'
    )


def _stats(details: "Details", url: str) -> str:
    tiles = [
        (details.questions, "Questions were asked" if details.questions != 1 else "Question was asked", "#fdf3e3", "#a8650c"),
        (details.action_items_total, "Action items detected" if details.action_items_total != 1 else "Action item detected", "#e9ecff", "#3a47b8"),
        (details.dates, "Dates & times discussed", "#fbeaf8", "#9b2c8f"),
    ]
    row = "".join(_tile(c, l, bg, fg) for c, l, bg, fg in tiles if c)
    out = (
        '<tr><td style="padding:30px 44px 0 44px;"><div style="border-top:1px solid #e6e8ee;"></div></td></tr>'
        '<tr><td align="center" style="padding:30px 44px 0 44px;font-size:22px;font-weight:600;color:#2b2b33;">&#128269; In this meeting</td></tr>'
    )
    if row:
        out += f'<tr><td style="padding:22px 39px 0 39px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>{row}</tr></table></td></tr>'
    if details.keywords:
        shown, more = details.keywords[:3], len(details.keywords) - 3
        chips = "".join(
            f'<span style="display:inline-block;border:1px solid #dfe2ea;background:#f6f7f9;border-radius:999px;padding:9px 18px;margin:5px 4px;font-size:16px;color:#2b2b33;">{escape(k)}</span>'
            for k in shown
        )
        if more > 0:
            chips += f'<span style="display:inline-block;border:1px solid #dfe2ea;border-radius:999px;padding:9px 18px;margin:5px 4px;font-size:16px;color:#2b2b33;">+{more} more</span>'
        out += (
            '<tr><td align="center" style="padding:34px 40px 0 40px;font-size:15px;letter-spacing:1px;color:#7a7f8c;">DISCUSSED IN THIS MEETING</td></tr>'
            f'<tr><td align="center" style="padding:12px 30px 0 30px;">{chips}</td></tr>'
        )
    out += (
        '<tr><td align="center" style="padding:26px 44px 0 44px;">'
        f'<a href="{escape(url, quote=True)}" style="display:block;background:#f3f4ff;color:{BRAND};border-radius:8px;padding:19px 8px;font-size:19px;text-decoration:none;">See more insights</a></td></tr>'
    )
    return out


def _overview(details: "Details", overview: str, url: str) -> str:
    items = details.bullets or ([overview] if overview else [])
    if not items:
        return ""
    lis = "".join(f'<li style="margin:0 0 10px 0;">{escape(b)}</li>' for b in items)
    return (
        '<tr><td style="padding:44px 44px 0 44px;"><div style="font-size:26px;font-weight:600;color:#2b2b33;">Meeting Overview</div>'
        f'<ul style="margin:22px 0 0 0;padding-left:24px;font-size:17px;line-height:28px;color:#33333a;">{lis}</ul></td></tr>'
        f'<tr><td align="center" style="padding:30px 44px 0 44px;"><a href="{escape(url, quote=True)}" style="display:block;background:{BRAND};color:#ffffff;'
        'border-radius:8px;padding:19px 8px;font-size:19px;text-decoration:none;">View complete meeting notes</a></td></tr>'
    )


def _promo(base: str) -> str:
    return f"""<tr><td style="background:#1b1450;background-image:linear-gradient(160deg,#1b1450 0%,#3a1f6e 55%,#8a3c7d 100%);padding:48px 30px 40px 30px;text-align:center;">
<div style="font-size:38px;line-height:46px;color:#ffffff;">Ask Fred about any meeting</div>
<div style="font-size:18px;line-height:28px;color:#cfcdee;margin-top:14px;">Who owns what, what was decided, what is still open. Answers come with the exact moment.</div>
<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin-top:26px;"><tr><td style="background:#5b4be8;border-radius:8px;"><a href="{escape(base, quote=True)}/askfred" style="display:block;padding:16px 26px;color:#ffffff;font-size:18px;text-decoration:none;">Try Ask Fred &rarr;</a></td></tr></table>
<table role="presentation" align="center" width="86%" cellpadding="0" cellspacing="0" style="margin-top:34px;background:#240f2e;border:1px solid #4a3560;border-radius:14px;"><tr>
<td style="padding:22px 22px 22px 24px;text-align:left;font-size:21px;line-height:30px;color:#ffffff;">What did Leo promise to send by <span style="background:#123a45;color:#58d4e6;border-radius:6px;padding:1px 6px;">Tuesday</span>?</td>
<td width="76" style="padding:0 18px 0 0;vertical-align:bottom;"><div style="background:#0e7a55;border-radius:8px;text-align:center;color:#ffffff;font-size:22px;line-height:46px;width:52px;height:46px;margin-bottom:18px;">&#10148;</div></td></tr></table>
<div style="font-size:15px;color:#a9a6c9;margin-top:22px;">Ask in plain words. No digging through transcripts.</div>
</td></tr>"""


def recap_html(
    *, owner_name: str, owner_email: str, title: str, started_at: datetime, overview: str, action_items: list[str],
    show_actions: bool, url: str, settings_url: str, notice: str, details: Details | None = None,
) -> str:
    base = url.split("/meetings/")[0]
    details = details or Details()
    extra = _stats(details, url) if (details.keywords or details.questions or details.action_items_total or details.dates) else ""
    extra += _overview(details, overview, url)
    if show_actions:
        items = "".join(f'<li style="margin:0 0 6px 0;">{escape(a)}</li>' for a in action_items[:10])
        extra += _section("Action items", f'<ul style="margin:0;padding-left:20px;font-size:15px;line-height:22px;color:#33333a;">{items}</ul>')
    if notice:
        extra += f'<tr><td style="padding:20px 44px 0 44px;text-align:center;font-size:14px;color:{MUTED};">{escape(notice)}</td></tr>'
    link = 'color:#555b66;'
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#f2f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:{INK};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">Your transcript and notes for {escape(title)} are ready.</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7;"><tr><td align="center" style="padding:0 0 28px 0;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;">
<tr><td align="center" style="padding:34px 0 8px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="150" height="150" align="center" valign="middle" style="background:#eef0ff;border-radius:75px;">{_bars(2.2)}</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:26px 30px 0 30px;"><div style="font-size:32px;line-height:38px;color:{BRAND};text-transform:uppercase;">{escape(owner_name)}</div>
  <div style="font-size:17px;color:#444;margin-top:4px;">({escape(owner_email)})</div></td></tr>
<tr><td align="center" style="padding:18px 30px 0 30px;"><div style="font-size:30px;line-height:38px;color:#000;">added a meeting to Fireflies Clone</div>
  <div style="font-size:17px;color:#222;margin-top:14px;">Your transcript and notes are ready</div></td></tr>
<tr><td style="padding:34px 44px 0 44px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dfe2ea;border-radius:14px;"><tr>
    <td width="84" style="padding:20px 0 20px 22px;"><div style="width:62px;height:62px;border-radius:31px;background:#f0f1ff;text-align:center;line-height:62px;font-size:26px;">&#128197;</div></td>
    <td style="padding:20px 18px 20px 16px;"><div style="font-size:21px;line-height:27px;color:#2b2b33;word-break:break-word;">{escape(title)}</div>
      <div style="font-size:17px;color:#7a7f8c;margin-top:4px;">{escape(when(started_at))}</div></td></tr></table>
</td></tr>
<tr><td style="padding:22px 38px 0 38px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>{_button("View meeting recap", url, True)}{_button("Share this recap", url, False)}</tr></table></td></tr>
{extra}
<tr><td style="height:46px;line-height:46px;font-size:1px;">&nbsp;</td></tr>
{_promo(base)}
<tr><td align="center" style="padding:44px 30px 0 30px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td valign="bottom">{_bars(1.2)}</td><td width="12"></td><td style="font-size:30px;color:#25254a;">Fireflies Clone</td></tr></table></td></tr>
<tr><td align="center" style="padding:34px 30px 0 30px;"><span style="display:inline-block;background:#f1f2f4;border-radius:999px;padding:14px 26px;font-size:17px;color:#444;">Meeting notes taken on behalf of {escape(owner_email)}</span></td></tr>
<tr><td align="center" style="padding:26px 40px 0 40px;font-size:16px;line-height:24px;color:#6b7280;">To stop receiving email notifications like this, <a href="{escape(settings_url, quote=True)}" style="{link}">click here to unsubscribe.</a></td></tr>
<tr><td align="center" style="padding:30px 30px 44px 30px;font-size:17px;"><a href="{escape(base, quote=True)}/privacy" style="{link}">DATA SECURITY &amp; POLICY</a></td></tr>
</table>
<div style="padding:30px 20px 0 20px;font-size:14px;color:#6b7280;text-align:center;">Fireflies Clone &bull; a demo project</div>
<div style="padding:14px 20px 0 20px;font-size:14px;text-align:center;"><a href="{escape(base, quote=True)}/privacy" style="{link}">Privacy Policy</a> &bull; <a href="{escape(base, quote=True)}/terms" style="{link}">Terms of Service</a></div>
</td></tr></table></body></html>"""


def recap_text(
    *, owner_name: str, owner_email: str, title: str, started_at: datetime, overview: str, action_items: list[str],
    show_actions: bool, url: str, notice: str, details: Details | None = None,
) -> str:
    details = details or Details()
    lines = [f"{owner_name} ({owner_email}) added a meeting to Fireflies Clone", "Your transcript and notes are ready.", "", title, when(started_at), ""]
    stats = [f"{n} {label}" for n, label in ((details.questions, "questions asked"), (details.action_items_total, "action items detected"), (details.dates, "dates and times discussed")) if n]
    if stats:
        lines += ["IN THIS MEETING", ", ".join(stats), ""]
    if details.keywords:
        lines += ["DISCUSSED: " + ", ".join(details.keywords[:8]), ""]
    if details.bullets or overview:
        lines += ["MEETING OVERVIEW", *[f"- {b}" for b in (details.bullets or [overview])], ""]
    if show_actions:
        lines += ["ACTION ITEMS", *[f"- {a}" for a in action_items[:10]], ""]
    if notice:
        lines += [notice, ""]
    lines += [f"View meeting recap: {url}", "", f"Meeting notes taken on behalf of {owner_email}"]
    return "\n".join(lines)
