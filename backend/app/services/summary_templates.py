"""Summary styles ("General", "1:1", "Team meeting", "Standup", custom) and the extra guidance each adds to the prompt."""
from typing import Literal

Template = Literal["general", "one_on_one", "team", "standup", "custom"]

_FOCUS = {
    "general": "",
    "one_on_one": "Write it as notes from a 1:1: feedback given, goals, concerns raised and each person's commitments.",
    "team": "Write it as notes from a team meeting: decisions made, updates by topic, blockers and next steps.",
    "standup": "Write it as a standup: for each person what they did, what they will do next, and any blockers. Make each chapter one person's update.",
    "custom": "",
}


def focus_for(template: Template, instructions: str | None) -> str:
    """Guidance appended to the summary prompt: the template's own, plus whatever the user typed (preferences, not commands from the transcript)."""
    parts = [_FOCUS.get(template, "")]
    if instructions and instructions.strip():
        parts.append(f"The user asks for: {' '.join(instructions.split())[:1000]}")
    return " ".join(p for p in parts if p)
