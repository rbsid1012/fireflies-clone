import httpx
import pytest

from app.services.llm_client import LLMClient, LLMError


def make(handler) -> LLMClient:
    return LLMClient("key-123", "some-model", base_url="https://api.example.test/v1/", http_client=httpx.Client(transport=httpx.MockTransport(handler)))


def test_openai_compatible_request_and_reply():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"], seen["auth"] = str(request.url), request.headers["authorization"]
        seen["body"] = __import__("json").loads(request.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": " Hello there "}, "finish_reason": "stop"}]})

    assert make(handler).chat("be brief", [{"role": "user", "content": "hi"}], max_tokens=16000) == "Hello there"
    assert seen["url"] == "https://api.example.test/v1/chat/completions"
    assert seen["auth"] == "Bearer key-123"
    assert seen["body"]["messages"][0] == {"role": "system", "content": "be brief"}
    assert seen["body"]["messages"][1]["content"] == "hi"
    assert seen["body"]["max_tokens"] == 8192


@pytest.mark.parametrize("status,fragment", [(401, "rejected"), (403, "rejected"), (429, "rate limited"), (413, "too long"), (500, "(500)")])
def test_http_errors_become_llm_errors(status, fragment):
    with pytest.raises(LLMError, match=fragment.replace("(", r"\(").replace(")", r"\)")):
        make(lambda r: httpx.Response(status, json={})).complete("s", "u")


def test_truncated_empty_and_malformed_replies():
    with pytest.raises(LLMError, match="cut off"):
        make(lambda r: httpx.Response(200, json={"choices": [{"message": {"content": "abc"}, "finish_reason": "length"}]})).complete("s", "u")
    with pytest.raises(LLMError, match="empty"):
        make(lambda r: httpx.Response(200, json={"choices": [{"message": {"content": None}, "finish_reason": "stop"}]})).complete("s", "u")
    with pytest.raises(LLMError, match="unexpected"):
        make(lambda r: httpx.Response(200, json={"nope": 1})).complete("s", "u")


def test_connection_failure():
    def boom(request):
        raise httpx.ConnectError("down")

    with pytest.raises(LLMError, match="Could not reach"):
        make(boom).complete("s", "u")


def test_odd_unicode_spaces_are_normalised_so_citations_still_parse():
    reply = "Decided [#7 02:39] and also this"
    client = make(lambda r: httpx.Response(200, json={"choices": [{"message": {"content": reply}, "finish_reason": "stop"}]}))
    assert client.complete("s", "u") == "Decided [#7 02:39] and also this"


def test_unicode_dashes_become_plain_hyphens_so_time_ranges_parse():
    reply = "Said [00:33‑01:00] here"
    client = make(lambda r: httpx.Response(200, json={"choices": [{"message": {"content": reply}, "finish_reason": "stop"}]}))
    assert client.complete("s", "u") == "Said [00:33-01:00] here"
