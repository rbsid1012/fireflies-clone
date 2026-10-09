from app.services.llm_client import LLMClient, LLMError


class FakeLLM(LLMClient):
    """Stands in for the Anthropic-backed client: returns a canned reply, or raises.

    `calls` holds (system, last user message); `conversations` the full message lists.
    """

    def __init__(self, reply: str = "", error: str | None = None):
        self.model = "fake-model"
        self.reply, self.error = reply, error
        self.calls: list[tuple[str, str]] = []
        self.conversations: list[list[dict[str, str]]] = []

    def chat(self, system: str, messages: list[dict[str, str]], max_tokens: int = 16000) -> str:
        self.calls.append((system, messages[-1]["content"]))
        self.conversations.append(messages)
        if self.error:
            raise LLMError(self.error)
        return self.reply
