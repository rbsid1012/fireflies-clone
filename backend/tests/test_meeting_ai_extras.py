import json

import pytest

from tests.fakes import FakeLLM

# What Whisper hands over: real timings, one generic speaker on every line
PLAIN = "\n".join(f"[00:00:{5 * i + 1:02d}] Speaker: {t}" for i, t in enumerate([
    "Thanks for joining, Daniel.", "Happy to be here, Priya.", "Let's start with the launch date.",
    "I think Friday works for me.", "Then Friday it is.",
]))

SUMMARY = json.dumps({"overview": "A short sync.", "keywords": ["launch"], "chapters": [{"title": "Launch date", "start_seq": 0, "summary": "Agreed Friday."}], "action_items": []})


def make(client, text=PLAIN):
    res = client.post("/api/meetings", json={"title": "Plain", "transcript_text": text})
    assert res.status_code == 201, res.text
    return res.json()


def test_summary_templates_and_instructions_reach_the_prompt(client, llm_holder):
    meeting = make(client)
    fake = llm_holder["llm"] = FakeLLM(SUMMARY)
    assert client.post(f"/api/meetings/{meeting['id']}/summary/regenerate", json={"template": "standup", "instructions": "mention the budget"}).status_code == 200
    system = fake.calls[-1][0]
    assert "standup" in system.lower() and "mention the budget" in system
    # No body at all still works and adds nothing
    fake2 = llm_holder["llm"] = FakeLLM(SUMMARY)
    assert client.post(f"/api/meetings/{meeting['id']}/summary/regenerate").status_code == 200
    assert "For this summary" not in fake2.calls[-1][0]
    assert client.post(f"/api/meetings/{meeting['id']}/summary/regenerate", json={"template": "nope"}).status_code == 422


def test_suggestions_come_from_the_model_with_a_safe_fallback(client, llm_holder):
    meeting = make(client)
    llm_holder["llm"] = FakeLLM(SUMMARY)
    client.post(f"/api/meetings/{meeting['id']}/summary/regenerate")
    llm_holder["llm"] = FakeLLM('Sure: ["What day was chosen?", "Who joined?", "What is next?"]')
    body = client.get(f"/api/meetings/{meeting['id']}/suggestions").json()
    assert body["questions"] == ["What day was chosen?", "Who joined?", "What is next?"]
    # A broken reply falls back to questions built from the outline, never an error
    llm_holder["llm"] = FakeLLM("not json at all")
    client.post(f"/api/meetings/{meeting['id']}/summary/regenerate")
    fallback = client.get(f"/api/meetings/{meeting['id']}/suggestions").json()["questions"]
    assert len(fallback) == 3 and fallback[0].startswith("What was said about")
    llm_holder["llm"] = None
    assert len(client.get(f"/api/meetings/{meeting['id']}/suggestions").json()["questions"]) == 3
    assert client.get("/api/meetings/99999/suggestions").status_code == 404


def test_identify_speakers_relabels_lines_and_people(client, llm_holder):
    meeting = make(client)
    assert len(client.get(f"/api/meetings/{meeting['id']}/transcript").json()["segments"]) == 5
    llm_holder["llm"] = FakeLLM(json.dumps({"speakers": ["Priya", "Daniel"], "labels": [0, 1, 0, 1, 0]}))
    res = client.post(f"/api/meetings/{meeting['id']}/speakers/identify")
    assert res.status_code == 200, res.text
    assert [p["name"] for p in res.json()["participants"]] == ["Priya", "Daniel"]
    lines = client.get(f"/api/meetings/{meeting['id']}/transcript").json()["segments"]
    assert [s["speaker_name"] for s in lines] == ["Priya", "Daniel", "Priya", "Daniel", "Priya"]


@pytest.mark.parametrize("reply", ['{"speakers": ["A"], "labels": [0, 0]}', '{"speakers": ["A"], "labels": [0, 0, 0, 0, 3]}', "nope", '{"speakers": [], "labels": [0, 0, 0, 0, 0]}'])
def test_bad_speaker_answers_change_nothing(client, llm_holder, reply):
    meeting = make(client)
    llm_holder["llm"] = FakeLLM(reply)
    res = client.post(f"/api/meetings/{meeting['id']}/speakers/identify")
    assert res.status_code == 502 and res.json()["code"] == "llm_error"
    assert len(client.get(f"/api/meetings/{meeting['id']}").json()["participants"]) == len(meeting["participants"])


def test_identifying_speakers_needs_a_model_and_an_owner(client, llm_holder):
    meeting = make(client)
    llm_holder["llm"] = None
    res = client.post(f"/api/meetings/{meeting['id']}/speakers/identify")
    assert res.status_code == 409 and res.json()["code"] == "needs_ai_model"
    llm_holder["llm"] = FakeLLM("{}")
    assert client.post("/api/meetings/99999/speakers/identify").status_code == 404


def test_a_chunk_holding_two_peoples_words_is_split_by_sentence_and_links_survive(client, llm_holder):
    text = "[00:00:00] Speaker: Welcome all. Thanks Priya. I will send the notes tomorrow.\n[00:00:20] Speaker: Great."
    meeting = client.post("/api/meetings", json={"title": "Chunked", "transcript_text": text}).json()
    llm_holder["llm"] = FakeLLM(json.dumps({"overview": "x", "keywords": [], "chapters": [{"title": "t", "start_seq": 0, "summary": "s"}], "action_items": [{"text": "Send the notes", "seq": 1, "assignee": None, "due": None}]}))
    client.post(f"/api/meetings/{meeting['id']}/summary/regenerate")
    before = next(a for a in client.get(f"/api/meetings/{meeting['id']}").json()["action_items"] if a["text"] == "Send the notes")
    assert before["source_start_ms"] == 20_000
    llm_holder["llm"] = FakeLLM(json.dumps({"speakers": ["Priya", "Dev"], "labels": [0, 1, 1, 0]}))
    assert client.post(f"/api/meetings/{meeting['id']}/speakers/identify").status_code == 200
    lines = client.get(f"/api/meetings/{meeting['id']}/transcript").json()["segments"]
    assert [(s["speaker_name"], s["text"]) for s in lines] == [
        ("Priya", "Welcome all."), ("Dev", "Thanks Priya. I will send the notes tomorrow."), ("Priya", "Great."),
    ]
    assert [s["seq"] for s in lines] == [0, 1, 2]
    assert lines[0]["start_ms"] == 0 and lines[1]["start_ms"] > 0 and lines[2]["start_ms"] == 20_000
    assert lines[1]["end_ms"] <= lines[2]["start_ms"] + 20_000
    after = next(a for a in client.get(f"/api/meetings/{meeting['id']}").json()["action_items"] if a["text"] == "Send the notes")
    assert after["source_start_ms"] == 20_000  # still points at the moment it was said
