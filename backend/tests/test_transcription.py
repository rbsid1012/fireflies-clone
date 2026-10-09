import httpx
import pytest

from app.config import settings
from app.errors import AppError, ValidationFailed
from app.services import transcription_service as ts


@pytest.fixture()
def stt(monkeypatch):
    monkeypatch.setattr(settings, "llm_api_key", "k")
    monkeypatch.setattr(settings, "llm_base_url", "https://api.example.test/v1")
    monkeypatch.setattr(settings, "stt_model", "whisper-test")


def client_for(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_segments_become_a_vtt_with_real_timings(stt):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"], seen["auth"], seen["body"] = str(request.url), request.headers["authorization"], request.content
        return httpx.Response(200, json={"segments": [{"start": 0.5, "end": 3.25, "text": " Hello team. "}, {"start": 3.25, "end": 3.25, "text": "Zero length."}, {"start": 4, "end": 6, "text": "   "}], "text": "x"})

    vtt = ts.transcribe(b"audio", "a.m4a", "audio/mp4", client_for(handler))
    assert seen["url"] == "https://api.example.test/v1/audio/transcriptions" and seen["auth"] == "Bearer k"
    assert b"whisper-test" in seen["body"] and b"verbose_json" in seen["body"]
    assert vtt.startswith("WEBVTT") and "00:00:00.500 --> 00:00:03.250" in vtt and "<v Speaker>Hello team." in vtt
    assert "00:00:03.250 --> 00:00:04.250" in vtt  # a zero-length cue is widened rather than dropped
    assert vtt.count("-->") == 2  # the blank one is skipped


def test_plain_text_fallback_and_empty_audio(stt):
    assert ts.transcribe(b"a", "a.wav", None, client_for(lambda r: httpx.Response(200, json={"text": " just words "}))) == "Speaker: just words"
    with pytest.raises(ValidationFailed, match="No speech"):
        ts.transcribe(b"a", "a.wav", None, client_for(lambda r: httpx.Response(200, json={"text": "  "})))


@pytest.mark.parametrize("status,fragment", [(401, "rejected"), (429, "rate limited"), (500, "(500)")])
def test_service_errors_are_readable(stt, status, fragment):
    with pytest.raises(AppError, match=fragment.replace("(", r"\(").replace(")", r"\)")):
        ts.transcribe(b"a", "a.wav", None, client_for(lambda r: httpx.Response(status, json={})))


def test_unavailable_and_oversized(monkeypatch, stt):
    with pytest.raises(ValidationFailed, match="too large"):
        ts.transcribe(b"x" * (ts.MAX_STT_BYTES + 1), "a.wav", None, client_for(lambda r: httpx.Response(200, json={})))
    monkeypatch.setattr(settings, "llm_base_url", None)
    assert ts.available() is False
    with pytest.raises(ValidationFailed) as err:
        ts.transcribe(b"a", "a.wav", None)
    assert err.value.code == "transcription_unavailable"


def test_a_recording_alone_creates_a_meeting_through_the_api(client, monkeypatch):
    monkeypatch.setattr(ts, "transcribe", lambda data, name, ctype, client=None: "WEBVTT\n\n1\n00:00:01.000 --> 00:00:04.000\n<v Speaker>We ship on Friday. I will send the notes.\n")
    res = client.post("/api/meetings", files={"media": ("Team sync.m4a", b"fake-audio-bytes", "audio/mp4")})
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["title"].lower().startswith("team sync") and body["media_url"] and body["participants"][0]["name"] == "Speaker"
    assert client.get(f"/api/meetings/{body['id']}/transcript").json()["segments"][0]["text"].startswith("We ship on Friday")


def test_a_recording_alone_without_speech_to_text_explains_what_to_do(client):
    res = client.post("/api/meetings", files={"media": ("sync.m4a", b"fake", "audio/mp4")})
    assert res.status_code == 422 and res.json()["code"] == "transcription_unavailable"


def test_filler_invented_over_silence_is_dropped(stt):
    segs = [{"start": 0.8, "end": 6.0, "text": "We ship on Friday."}, {"start": 110, "end": 139.98, "text": " Thank you."}]
    vtt = ts.to_vtt(segs)
    assert "We ship on Friday." in vtt and "Thank you" not in vtt
    # ...but a genuinely slow, short utterance is kept
    assert "Okay." in ts.to_vtt([{"start": 1, "end": 4, "text": "Okay."}])
