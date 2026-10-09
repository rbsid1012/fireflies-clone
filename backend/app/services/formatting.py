import re


def format_timestamp(ms: int) -> str:
    """Milliseconds -> 'mm:ss' (or 'h:mm:ss' from one hour)."""
    total = max(0, ms) // 1000
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m:02d}:{s:02d}"


def format_duration(ms: int) -> str:
    minutes = max(1, round(ms / 60_000)) if ms else 0
    h, m = divmod(minutes, 60)
    return f"{h} h {m} min" if h else f"{m} min"


def slugify(text: str, fallback: str = "meeting") -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:80] or fallback
