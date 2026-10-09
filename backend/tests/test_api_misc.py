import json

from tests.fakes import FakeLLM

LLM_REPLY = json.dumps({
    "overview": "LLM overview.", "keywords": ["alpha"],
    "chapters": [{"title": "Only chapter", "start_seq": 0, "summary": "s"}],
    "action_items": [{"text": "Brand new LLM task", "seq": 0, "assignee": None, "due": None}],
})


def meeting_id(c, q):
    return c.get(f"/api/meetings?q={q}").json()["items"][0]["id"]


# ---------------------------------------------------------------- me / people / tags / health

def test_health_me_people_tags(seeded):
    assert seeded.get("/api/health").json() == {"status": "ok"}
    me = seeded.get("/api/me").json()
    assert me["name"] == "Alex Morgan" and me["email"] == "alex.morgan@lumenly.io"
    people = seeded.get("/api/people").json()
    assert len(people) == 12 and people == sorted(people, key=lambda p: p["name"])
    assert {"id", "name", "email", "meeting_count"} <= set(people[0])
    tags = seeded.get("/api/tags").json()
    assert len(tags) == 12 and {"id", "name", "color", "meeting_count"} <= set(tags[0])
    assert {t["name"]: t["meeting_count"] for t in tags}["engineering"] == 2


def test_default_user_is_created_on_an_empty_database(client):
    assert client.get("/api/me").json()["name"] == "Alex Morgan"
    assert client.get("/api/people").json() == [] and client.get("/api/tags").json() == []
    assert client.get("/api/meetings").json() == {"items": [], "total": 0, "page": 1, "limit": 20}


# ---------------------------------------------------------------- export

def test_markdown_export(seeded):
    mid = meeting_id(seeded, "interview")
    res = seeded.get(f"/api/meetings/{mid}/export?format=md")
    assert res.status_code == 200 and res.headers["content-type"].startswith("text/markdown")
    assert res.headers["content-disposition"] == 'attachment; filename="senior-backend-engineer-interview-ravi-shankar.md"'
    body = res.text
    for expected in ["# Senior Backend Engineer Interview - Ravi Shankar", "## Overview", "## Outline",
                     "## Action items", "## Transcript", "- [x] Debrief", "**[00:01] Alex Morgan:**", "Participants: Alex Morgan, Marcus Chen, Ravi Shankar"]:
        assert expected in body, expected
    assert body.count("**[") == 44 and body.endswith("\n")


def test_plain_text_export_has_no_markdown_syntax(seeded):
    mid = meeting_id(seeded, "standup")
    res = seeded.get(f"/api/meetings/{mid}/export?format=txt")
    assert res.headers["content-type"].startswith("text/plain") and res.headers["content-disposition"].endswith('.txt"')
    assert res.text.startswith("Engineering Daily Standup\n=====")
    assert "**" not in res.text and "## " not in res.text
    assert "[00:01] Alex Morgan: Morning everyone." in res.text
    assert "[done] Rotate the staging queue credentials" in res.text and "(Dmitri Volkov)" in res.text


def test_export_defaults_to_markdown_and_rejects_unknown_formats(seeded):
    mid = meeting_id(seeded, "standup")
    assert seeded.get(f"/api/meetings/{mid}/export").text.startswith("# ")
    assert seeded.get(f"/api/meetings/{mid}/export?format=pdf").status_code == 422


def test_export_of_a_long_meeting_uses_hour_timestamps(client):
    lines = "\n".join(f"[{h:02d}:00:00] A: point {h}" for h in range(0, 3))
    mid = client.post("/api/meetings", json={"title": "Long", "transcript_text": lines}).json()["id"]
    assert "[2:00:00] A: point 2" in client.get(f"/api/meetings/{mid}/export?format=txt").text


# ---------------------------------------------------------------- regenerate

def test_regenerate_heuristic_keeps_existing_action_items(seeded):
    mid = meeting_id(seeded, "postmortem")
    before = seeded.get(f"/api/meetings/{mid}").json()
    done = next(a for a in before["action_items"] if a["is_completed"])
    after = seeded.post(f"/api/meetings/{mid}/summary/regenerate").json()
    assert after["summary"]["generated_by"] == "heuristic"
    assert after["summary"]["generated_at"] >= before["summary"]["generated_at"]
    assert after["chapters"] and after["chapters"] != before["chapters"]
    kept = {a["id"]: a for a in after["action_items"]}
    assert all(a["id"] in kept for a in before["action_items"])  # nothing deleted
    assert kept[done["id"]]["is_completed"] and kept[done["id"]]["completed_at"] == done["completed_at"]
    texts = [a["text"].lower() for a in after["action_items"]]
    assert len(texts) == len(set(texts))  # no duplicate suggestions

    again = seeded.post(f"/api/meetings/{mid}/summary/regenerate").json()
    assert [a["id"] for a in again["action_items"]] == [a["id"] for a in after["action_items"]]  # idempotent


def test_regenerate_with_llm(seeded, llm_holder):
    llm_holder["llm"] = FakeLLM(LLM_REPLY)
    mid = meeting_id(seeded, "standup")
    n_before = len(seeded.get(f"/api/meetings/{mid}").json()["action_items"])
    res = seeded.post(f"/api/meetings/{mid}/summary/regenerate").json()
    assert res["summary"]["generated_by"] == "llm" and res["summary"]["overview"] == "LLM overview."
    assert [c["title"] for c in res["chapters"]] == ["Only chapter"]
    assert len(res["action_items"]) == n_before + 1
    assert "Brand new LLM task" in [a["text"] for a in res["action_items"]]


def test_regenerate_falls_back_when_llm_fails(seeded, llm_holder):
    llm_holder["llm"] = FakeLLM(error="boom")
    mid = meeting_id(seeded, "standup")
    res = seeded.post(f"/api/meetings/{mid}/summary/regenerate")
    assert res.status_code == 200 and res.json()["summary"]["generated_by"] == "heuristic"


def test_create_uses_llm_when_configured(client, llm_holder):
    llm_holder["llm"] = FakeLLM(LLM_REPLY)
    m = client.post("/api/meetings", json={"title": "LLM", "transcript_text": "Alice: hello\nBob: hi"}).json()
    assert m["summary"]["generated_by"] == "llm" and m["status"] == "ready"


def test_regenerate_404(client):
    assert client.post("/api/meetings/999/summary/regenerate").status_code == 404


# ---------------------------------------------------------------- API surface

EXPECTED_ROUTES = {
    ("get", "/api/meetings"), ("post", "/api/meetings"), ("get", "/api/meetings/{meeting_id}"),
    ("patch", "/api/meetings/{meeting_id}"), ("delete", "/api/meetings/{meeting_id}"),
    ("get", "/api/meetings/{meeting_id}/transcript"), ("get", "/api/meetings/{meeting_id}/transcript/search"),
    ("post", "/api/meetings/{meeting_id}/summary/regenerate"), ("get", "/api/meetings/{meeting_id}/export"),
    ("post", "/api/meetings/{meeting_id}/action-items"), ("patch", "/api/action-items/{item_id}"),
    ("delete", "/api/action-items/{item_id}"), ("get", "/api/search"), ("get", "/api/people"),
    ("get", "/api/tags"), ("get", "/api/me"), ("post", "/api/meetings/{meeting_id}/ask"), ("post", "/api/ask"),
}


def test_every_planned_route_is_documented_in_openapi(client):
    spec = client.get("/openapi.json").json()
    documented = {(m, p) for p, ops in spec["paths"].items() for m in ops}
    assert EXPECTED_ROUTES <= documented
    assert client.get("/docs").status_code == 200


def test_every_json_route_declares_a_response_schema(client):
    spec = client.get("/openapi.json").json()
    for path, ops in spec["paths"].items():
        for method, op in ops.items():
            ok = next(code for code in op["responses"] if code.startswith("2"))
            if ok == "204" or path.endswith("/export") or path.startswith("/api/media/"):  # binary responses
                continue
            schema = op["responses"][ok]["content"]["application/json"]["schema"]
            assert schema and schema != {}, (method, path)


def test_create_endpoint_documents_json_and_multipart(client):
    body = client.get("/openapi.json").json()["paths"]["/api/meetings"]["post"]["requestBody"]["content"]
    assert set(body) == {"application/json", "multipart/form-data"}
    assert body["multipart/form-data"]["schema"]["properties"]["file"]["format"] == "binary"


def test_cors_allows_the_configured_frontend_origin(client):
    res = client.options("/api/meetings", headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "POST"})
    assert res.headers["access-control-allow-origin"] == "http://localhost:3000"


# ---------------------------------------------------------------- channels (tags created ahead of time)

def test_create_list_and_delete_a_channel(seeded):
    res = seeded.post("/api/tags", json={"name": "  Board   prep "})
    assert res.status_code == 201
    tag = res.json()
    assert tag["name"] == "Board prep" and tag["meeting_count"] == 0
    assert "Board prep" in [t["name"] for t in seeded.get("/api/tags").json()]

    # names are unique per owner, ignoring case
    dup = seeded.post("/api/tags", json={"name": "board PREP"})
    assert (dup.status_code, dup.json()["code"]) == (409, "tag_exists")
    assert seeded.post("/api/tags", json={"name": "   "}).status_code == 422

    # deleting removes the label from meetings without touching the meetings
    meeting = seeded.get("/api/meetings", params={"limit": 1}).json()["items"][0]
    seeded.patch(f"/api/meetings/{meeting['id']}", json={"tags": ["Board prep"]})
    assert seeded.get("/api/meetings", params={"tag": "board prep"}).json()["total"] == 1
    assert seeded.delete(f"/api/tags/{tag['id']}").status_code == 204
    assert seeded.get("/api/meetings", params={"tag": "board prep"}).json()["total"] == 0
    assert seeded.get(f"/api/meetings/{meeting['id']}").status_code == 200
    assert seeded.delete(f"/api/tags/{tag['id']}").status_code == 404


def test_meetings_can_be_filtered_by_how_they_were_added(client):
    vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nAlice: Hello there.\n"
    client.post("/api/meetings", files={"file": ("a.vtt", vtt, "text/vtt")})
    client.post("/api/meetings", json={"transcript_text": "Bob: Pasted words.", "title": "Pasted"})
    assert client.get("/api/meetings", params={"source": "upload"}).json()["total"] == 1
    assert client.get("/api/meetings", params={"source": "paste"}).json()["total"] == 1
    assert client.get("/api/meetings", params={"source": "seed"}).json()["total"] == 0
    assert client.get("/api/meetings", params={"source": "nonsense"}).status_code == 422
