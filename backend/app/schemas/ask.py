from typing import Literal

from pydantic import BaseModel, Field


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    # Earlier turns of this conversation, oldest first (the client keeps the thread)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)


class AskSource(BaseModel):
    """A transcript moment an answer is based on; the UI turns these into jump-to links."""

    meeting_id: int
    meeting_title: str
    segment_id: int | None
    start_ms: int
    speaker_name: str | None
    text: str


class AskOut(BaseModel):
    answer: str
    # "llm": written by the model. "search": answered from your meetings' data with no model.
    mode: Literal["llm", "search"]
    model: str | None
    sources: list[AskSource]


class SuggestionsOut(BaseModel):
    questions: list[str]
