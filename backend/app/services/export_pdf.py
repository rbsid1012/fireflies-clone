"""Render a meeting as a PDF (built-in Helvetica, so text is limited to Latin-1; common punctuation is mapped)."""
from fpdf import FPDF

from app.models import Meeting
from app.services.formatting import format_duration, format_timestamp
from app.services.notes_format import parse

_PUNCT = str.maketrans({
    "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "‑": "-",
    "…": "...", " ": " ", " ": " ", "•": "-", "○": "-",
})


def _t(text: str) -> str:
    return text.translate(_PUNCT).encode("latin-1", "replace").decode("latin-1")


class _Doc(FPDF):
    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", size=8)
        self.set_text_color(130)
        self.cell(0, 6, f"Page {self.page_no()}", align="C")


def _heading(pdf: _Doc, text: str) -> None:
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(40, 30, 120)
    pdf.cell(0, 8, _t(text), new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(30)


def _body(pdf: _Doc, text: str, indent: float = 0, size: float = 10) -> None:
    pdf.set_font("Helvetica", size=size)
    pdf.set_x(pdf.l_margin + indent)
    pdf.multi_cell(0, 5.2, _t(text), new_x="LMARGIN", new_y="NEXT")


def render_pdf(meeting: Meeting, segments: list) -> bytes:
    pdf = _Doc(format="A4")
    pdf.set_margins(18, 18, 18)
    pdf.set_auto_page_break(True, margin=18)
    pdf.add_page()

    pdf.set_font("Helvetica", "B", 20)
    pdf.set_text_color(30)
    pdf.multi_cell(0, 9, _t(meeting.title), new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(110)
    _body(pdf, f"{meeting.started_at:%Y-%m-%d %H:%M} UTC  |  {format_duration(meeting.duration_ms)}")
    if meeting.participants:
        _body(pdf, "Participants: " + ", ".join(p.name for p in meeting.participants))
    if meeting.tags:
        _body(pdf, "Tags: " + ", ".join(t.name for t in meeting.tags))
    pdf.set_text_color(30)

    if meeting.summary and meeting.summary.overview:
        _heading(pdf, "Overview")
        _body(pdf, meeting.summary.overview)
        if meeting.summary.keywords:
            pdf.set_text_color(110)
            _body(pdf, "Keywords: " + ", ".join(meeting.summary.keywords), size=9)
            pdf.set_text_color(30)

    if meeting.chapters:
        _heading(pdf, "Notes")
        for ch in meeting.chapters:
            pdf.set_font("Helvetica", "B", 10)
            pdf.multi_cell(0, 6, _t(f"{ch.title}  ({format_timestamp(ch.start_ms)})"), new_x="LMARGIN", new_y="NEXT")
            for point in parse(ch.summary):
                stamp = f" ({format_timestamp(point.ms)})" if point.ms is not None else ""
                _body(pdf, f"-  {point.text}{stamp}", indent=3)
                for sub in point.subs:
                    _body(pdf, f"o  {sub}", indent=10, size=9.5)
            pdf.ln(1.5)

    if meeting.action_items:
        _heading(pdf, "Action items")
        for item in meeting.action_items:
            who = f" ({item.assignee.name})" if item.assignee else ""
            due = f" - due {item.due_date.isoformat()}" if item.due_date else ""
            _body(pdf, f"[{'x' if item.is_completed else ' '}] {item.text}{who}{due}", indent=3)

    _heading(pdf, "Transcript")
    for seg in segments:
        pdf.set_font("Helvetica", "B", 9.5)
        pdf.set_text_color(70, 60, 160)
        pdf.cell(0, 5.2, _t(f"[{format_timestamp(seg.start_ms)}] {seg.speaker_name or 'Unknown'}"), new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(30)
        _body(pdf, seg.text, indent=3, size=9.5)
        pdf.ln(1.2)
    return bytes(pdf.output())
