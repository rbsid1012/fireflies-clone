"""Thin wrapper over a chat model. Absent when LLM_API_KEY is unset.

Talks to any OpenAI-compatible `/chat/completions` endpoint (Groq, Google Gemini, OpenRouter, ...),
which is how free tiers are used. LLM_BASE_URL picks the provider.
"""
import re

import httpx

from app.config import settings


# Some models emit no-break / narrow spaces (U+00A0, U+202F, ...). They would break "[#7 02:39]" citations.
_ODD_SPACES = re.compile("[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]")
_DASHES = re.compile("[\u2010-\u2015]")


def _tidy(text: str) -> str:
    return _DASHES.sub("-", _ODD_SPACES.sub(" ", text))


class LLMError(RuntimeError):
    """Any failure talking to the model. Callers fall back or surface a 502."""


class LLMClient:
    def __init__(self, api_key: str, model: str, base_url: str, http_client: httpx.Client | None = None):
        self.model = model
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._http = http_client or httpx.Client(timeout=90.0)

    def complete(self, system: str, user: str, max_tokens: int = 16000) -> str:
        return self.chat(system, [{"role": "user", "content": user}], max_tokens)

    def chat(self, system: str, messages: list[dict[str, str]], max_tokens: int = 16000) -> str:
        """`messages` alternate user/assistant and must end with a user turn."""
        return self._chat_openai_compatible(system, messages, max_tokens)

    def _chat_openai_compatible(self, system: str, messages: list[dict[str, str]], max_tokens: int) -> str:
        body = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, *messages],
            "max_tokens": min(max_tokens, 8192),  # free tiers cap output length
        }
        try:
            response = self._http.post(
                f"{self._base_url}/chat/completions", json=body, headers={"Authorization": f"Bearer {self._api_key}"}
            )
        except httpx.HTTPError as exc:
            raise LLMError("Could not reach the model API.") from exc
        if response.status_code in (401, 403):
            raise LLMError("The configured LLM_API_KEY was rejected.")
        if response.status_code == 429:
            raise LLMError("The model is rate limited right now. Try again shortly.")
        if response.status_code == 413:
            raise LLMError("This transcript is too long for the configured model.")
        if response.status_code >= 400:
            raise LLMError(f"The model API returned an error ({response.status_code}).")
        try:
            choice = response.json()["choices"][0]
            text = _tidy(choice["message"].get("content") or "").strip()
        except (ValueError, KeyError, IndexError, TypeError, AttributeError) as exc:
            raise LLMError("The model API returned an unexpected response.") from exc
        if choice.get("finish_reason") == "length":
            raise LLMError("The model's reply was cut off.")
        if not text:
            raise LLMError("The model returned an empty reply.")
        return text


def get_llm_client() -> LLMClient | None:
    if not settings.llm_api_key or not settings.llm_base_url:
        return None
    return LLMClient(settings.llm_api_key, settings.llm_model, base_url=settings.llm_base_url)
