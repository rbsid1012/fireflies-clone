import json

PASTE = (
    "[00:00:05] Alice: We need to ship the report by Friday.\n"
    "[00:00:14] Bob: I'll send the draft tomorrow, and the deploying pipeline is ready.\n"
    "[00:00:30] Alice: Great, thanks."
)


def ids(resp):
    return [m["id"] for m in resp.json()["items"]]


def titles(resp):
    return [m["title"] for m in resp.json()["items"]]


# ---------------------------------------------------------------- list & filters

def test_list_returns_page_envelope_and_seeded_meetings(seeded):
    body = seeded.get("/api/meetings").json()
    assert (body["total"], body["page"], body["limit"]) == (7, 1, 20)
    first = body["items"][0]
    assert first["title"] == "Q4 Launch Campaign Planning"  # most recent first
    assert first["started_at"].endswith("Z")  # timezone-aware, never ambiguous
    assert {p["name"] for p in first["participants"]} >= {"Nina Castellanos"}
    assert first["action_items_total"] == 6 and first["action_items_open"] == 5
    assert [t["name"] for t in first["tags"]] == ["marketing", "planning"]


def test_sorting(seeded):
    assert titles(seeded.get("/api/meetings?sort=title"))[0] == "1:1 - Alex and Marcus"
    assert titles(seeded.get("/api/meetings?sort=oldest"))[0] == "Q3 Mobile App Product Review"
    longest = seeded.get("/api/meetings?sort=duration").json()["items"]
    assert longest[0]["duration_ms"] >= longest[-1]["duration_ms"]


def test_pagination(seeded):
    page3 = seeded.get("/api/meetings?limit=3&page=3").json()
    assert page3["total"] == 7 and len(page3["items"]) == 1
    all_ids = [i for p in (1, 2, 3) for i in ids(seeded.get(f"/api/meetings?limit=3&page={p}"))]
    assert len(all_ids) == len(set(all_ids)) == 7
    assert seeded.get("/api/meetings?page=99").json()["items"] == []


def test_filter_by_tag_is_case_insensitive(seeded):
    assert titles(seeded.get("/api/meetings?tag=SALES")) == ["Northwind Logistics - Discovery Call"]
    assert seeded.get("/api/meetings?tag=nope").json()["total"] == 0


def test_filter_by_participant(seeded):
    people = {p["name"]: p for p in seeded.get("/api/people").json()}
    alex = people["Alex Morgan"]
    assert alex["meeting_count"] == 5
    assert seeded.get(f"/api/meetings?participant_id={alex['id']}").json()["total"] == 5
    ravi = people["Ravi Shankar"]
    assert titles(seeded.get(f"/api/meetings?participant_id={ravi['id']}")) == [
        "Senior Backend Engineer Interview - Ravi Shankar"
    ]


def test_filter_by_date_range_is_inclusive_of_the_end_day(seeded):
    res = seeded.get("/api/meetings?from=2026-10-01&to=2026-10-02")
    assert sorted(titles(res)) == [
        "Incident Postmortem - Tracking API Latency",
        "Senior Backend Engineer Interview - Ravi Shankar",
    ]
    assert seeded.get("/api/meetings?to=2026-09-24").json()["total"] == 1


def test_text_query_matches_title_or_transcript(seeded):
    assert titles(seeded.get("/api/meetings?q=kafka")) == ["Senior Backend Engineer Interview - Ravi Shankar"]
    northwind = titles(seeded.get("/api/meetings?q=northwind"))
    assert "Northwind Logistics - Discovery Call" in northwind  # title match
    assert "Incident Postmortem - Tracking API Latency" in northwind  # transcript-only match
    assert seeded.get("/api/meetings?q=standup").json()["total"] == 1  # title only


def test_query_is_safe_against_sql_and_fts_syntax(seeded):
    for q in ['"', "AND OR NOT", "foo*bar(", "%", "_", "'; DROP TABLE meetings;--", "NEAR(", "a" * 200]:
        assert seeded.get("/api/meetings", params={"q": q}).status_code == 200


def test_filters_combine(seeded):
    res = seeded.get("/api/meetings?tag=engineering&q=latency")
    assert titles(res) == ["Incident Postmortem - Tracking API Latency"]


def test_invalid_query_params_are_422_in_standard_shape(seeded):
    for qs in ("limit=0", "limit=101", "page=0", "sort=nope", "from=notadate", "participant_id=abc"):
        res = seeded.get(f"/api/meetings?{qs}")
        assert res.status_code == 422, qs
        assert set(res.json()) == {"detail", "code"} and res.json()["code"] == "validation_error"


# ---------------------------------------------------------------- detail

def test_detail_has_everything_the_page_needs(seeded):
    mid = ids(seeded.get("/api/meetings?q=kafka"))[0]
    d = seeded.get(f"/api/meetings/{mid}").json()
    assert d["status"] == "ready" and d["source"] == "seed" and d["media_url"] is None
    assert d["summary"]["generated_by"] == "seed" and d["summary"]["keywords"]
    assert len(d["chapters"]) == 6 and d["chapters"][0]["start_ms"] >= 0
    assert [p["speaker_label"] for p in d["participants"]] == ["Alex", "Marcus", "Ravi"]
    item = d["action_items"][0]
    assert item["assignee"]["name"] == "Alex Morgan" and item["source_start_ms"] is not None


def test_unknown_meeting_is_404_in_standard_shape(client):
    for method, url in [("get", "/api/meetings/999"), ("delete", "/api/meetings/999"),
                        ("get", "/api/meetings/999/transcript"), ("get", "/api/meetings/999/export")]:
        res = getattr(client, method)(url)
        assert res.status_code == 404, url
        assert res.json() == {"detail": "Meeting not found", "code": "not_found"}


def test_unknown_route_uses_the_same_error_shape(client):
    res = client.get("/api/nope")
    assert res.status_code == 404 and res.json()["code"] == "not_found"


def test_non_integer_id_is_422(client):
    assert client.get("/api/meetings/abc").status_code == 422


# ---------------------------------------------------------------- create

def test_create_from_pasted_json(client):
    res = client.post("/api/meetings", json={"title": "Weekly sync", "started_at": "2026-10-05T10:00:00Z", "transcript_text": PASTE})
    assert res.status_code == 201
    m = res.json()
    assert m["title"] == "Weekly sync" and m["source"] == "paste" and m["status"] == "ready"
    assert [p["name"] for p in m["participants"]] == ["Alice", "Bob"]
    assert [p["color_index"] for p in m["participants"]] == [0, 1]
    assert m["summary"]["generated_by"] == "heuristic" and m["summary"]["overview"]
    assert m["chapters"] and m["duration_ms"] >= 30_000

    by_text = {a["text"]: a for a in m["action_items"]}
    ship = by_text["We need to ship the report by Friday."]
    assert ship["due_date"] == "2026-10-09" and ship["assignee"] is None
    draft = next(a for t, a in by_text.items() if t.startswith("I'll send the draft tomorrow"))
    assert draft["assignee"]["name"] == "Bob" and draft["due_date"] == "2026-10-06"
    assert draft["source_segment_id"] is not None

    transcript = client.get(f"/api/meetings/{m['id']}/transcript").json()
    assert [s["start_ms"] for s in transcript["segments"]] == [5000, 14000, 30000]
    assert transcript["segments"][1]["speaker_name"] == "Bob"


def test_create_defaults_title_and_start_time(client):
    m = client.post("/api/meetings", json={"transcript_text": "Alice: hi there"}).json()
    assert m["title"] == "Untitled meeting"
    assert m["started_at"].endswith("Z")


def test_create_from_uploaded_file_uses_filename_and_format(client):
    vtt = b"WEBVTT\n\n00:00:01.000 --> 00:00:04.000\n<v Dana>Hello team</v>\n"
    res = client.post("/api/meetings", files={"file": ("product_sync-notes.vtt", vtt, "text/vtt")})
    assert res.status_code == 201
    m = res.json()
    assert m["source"] == "upload" and m["title"] == "product sync notes"
    assert [p["name"] for p in m["participants"]] == ["Dana"]


def test_create_multipart_with_form_fields_and_json_file(client):
    data = json.dumps([{"speaker": "A", "start": 0, "end": 3, "text": "hi"}]).encode()
    res = client.post(
        "/api/meetings", data={"title": "From JSON", "started_at": "2026-03-01T09:00:00Z"},
        files={"file": ("t.json", data, "application/json")},
    )
    assert res.status_code == 201 and res.json()["title"] == "From JSON"
    assert res.json()["started_at"] == "2026-03-01T09:00:00Z"


def test_create_multipart_with_pasted_text_field(client):
    res = client.post("/api/meetings", data={"transcript_text": PASTE, "title": "Form paste"})
    assert res.status_code == 201 and res.json()["source"] == "paste"


def test_create_reuses_people_by_name_but_never_merges_generic_speakers(client):
    a = client.post("/api/meetings", json={"transcript_text": "Priya Nair: hi\nSpeaker 1: hello"}).json()
    other = json.dumps([{"speaker": "priya nair", "text": "again"}, {"speaker": "Speaker 1", "text": "other"}])
    b = client.post("/api/meetings", json={"transcript_text": other}).json()  # different letter case
    person = lambda m, label: next(p["person_id"] for p in m["participants"] if p["speaker_label"].lower() == label)
    assert person(a, "priya nair") == person(b, "priya nair")
    assert person(a, "speaker 1") != person(b, "speaker 1")
    people = {p["name"]: p["meeting_count"] for p in client.get("/api/people").json()}
    assert people["Priya Nair"] == 2


def test_created_meeting_is_searchable_and_listed(client):
    mid = client.post("/api/meetings", json={"title": "Searchable", "transcript_text": PASTE}).json()["id"]
    hits = client.get("/api/search?q=deploy").json()["hits"]
    assert [h["meeting_id"] for h in hits] == [mid]  # stemming: deploying ~ deploy
    assert client.get("/api/meetings?q=pipeline").json()["total"] == 1


def test_create_errors_are_422_with_clear_messages(client):
    cases = [
        ({"json": {"title": "x"}}, "Provide a transcript"),
        ({"json": {"transcript_text": "   "}}, "empty"),
        ({"json": {"transcript_text": "WEBVTT\n\n00:00:01 --> bad\nhi", "format": "vtt"}}, "Invalid cue timing"),
        ({"json": {"transcript_text": "x", "format": "docx"}}, "format"),
        ({"json": {"transcript_text": "x", "started_at": "yesterday"}}, "started_at"),
        ({"files": {"file": ("deck.pdf", b"%PDF-", "application/pdf")}}, "Unsupported file type"),
        ({"files": {"file": ("a.txt", b"\xff\xfe\x00", "text/plain")}}, "UTF-8"),
        ({"files": {"file": ("a.txt", b"Alice: hi", "text/plain")}, "data": {"transcript_text": "Bob: hi"}}, "not both"),
    ]
    for kwargs, fragment in cases:
        res = client.post("/api/meetings", **kwargs)
        assert res.status_code == 422, (kwargs, res.text)
        assert fragment in res.json()["detail"], (fragment, res.json())
        assert set(res.json()) == {"detail", "code"}
    assert client.get("/api/meetings").json()["total"] == 0  # nothing half-created


def test_create_with_malformed_json_body_is_422(client):
    res = client.post("/api/meetings", content=b"{not json", headers={"content-type": "application/json"})
    assert res.status_code == 422 and res.json()["code"] == "validation_error"


def test_invalid_transcript_has_its_own_error_code(client):
    res = client.post("/api/meetings", json={"transcript_text": "WEBVTT\n\nnothing"})
    assert res.json()["code"] == "invalid_transcript"


def test_summary_failure_keeps_the_transcript_and_marks_failed(client, monkeypatch):
    from app.services import meeting_service

    def boom(*a, **k):
        raise RuntimeError("summarizer exploded")

    monkeypatch.setattr(meeting_service, "generate_summary", boom)
    res = client.post("/api/meetings", json={"title": "Fragile", "transcript_text": PASTE})
    assert res.status_code == 201 and res.json()["status"] == "failed"
    mid = res.json()["id"]
    monkeypatch.undo()
    fixed = client.post(f"/api/meetings/{mid}/summary/regenerate").json()
    assert fixed["status"] == "ready" and fixed["summary"]["overview"]
    assert len(client.get(f"/api/meetings/{mid}/transcript").json()["segments"]) == 3


# ---------------------------------------------------------------- update

def test_patch_title_and_start_time(seeded):
    mid = ids(seeded.get("/api/meetings"))[0]
    res = seeded.patch(f"/api/meetings/{mid}", json={"title": "  Renamed   meeting ", "started_at": "2026-01-02T03:04:05Z"})
    assert res.status_code == 200
    assert res.json()["title"] == "Renamed meeting" and res.json()["started_at"] == "2026-01-02T03:04:05Z"
    assert res.json()["updated_at"] >= res.json()["created_at"]


def test_patch_tags_replaces_dedupes_and_registers_new_tags(seeded):
    mid = ids(seeded.get("/api/meetings"))[0]
    res = seeded.patch(f"/api/meetings/{mid}", json={"tags": ["Roadmap", "roadmap", " Q4  Launch ", "planning"]})
    assert [t["name"] for t in res.json()["tags"]] == ["planning", "Q4 Launch", "Roadmap"]
    tags = {t["name"]: t["meeting_count"] for t in seeded.get("/api/tags").json()}
    assert tags["Roadmap"] == 1 and tags["planning"] == 1
    assert tags["marketing"] == 0  # removed from this meeting
    cleared = seeded.patch(f"/api/meetings/{mid}", json={"tags": []}).json()
    assert cleared["tags"] == []


def test_patch_omitted_fields_are_untouched(seeded):
    mid = ids(seeded.get("/api/meetings"))[0]
    before = seeded.get(f"/api/meetings/{mid}").json()
    after = seeded.patch(f"/api/meetings/{mid}", json={"title": "Only title"}).json()
    assert after["tags"] == before["tags"] and after["participants"] == before["participants"]


def test_patch_rename_a_speaker_to_a_new_person(client):
    m = client.post("/api/meetings", json={"transcript_text": "Speaker 1: hi\nSpeaker 2: hello"}).json()
    sp2 = next(p for p in m["participants"] if p["speaker_label"] == "Speaker 2")
    res = client.patch(f"/api/meetings/{m['id']}", json={"participants": [{"id": sp2["id"], "name": "Greg Holloway", "email": "greg@northwind.com"}]})
    assert res.status_code == 200
    renamed = next(p for p in res.json()["participants"] if p["id"] == sp2["id"])
    assert (renamed["name"], renamed["email"], renamed["speaker_label"]) == ("Greg Holloway", "greg@northwind.com", "Speaker 2")
    seg = client.get(f"/api/meetings/{m['id']}/transcript").json()["segments"][1]
    assert seg["speaker_name"] == "Greg Holloway" and seg["speaker_label"] == "Speaker 2"
    assert any(p["name"] == "Greg Holloway" for p in client.get("/api/people").json())


def test_patch_point_a_speaker_at_an_existing_person(seeded, client):
    people = {p["name"]: p["id"] for p in seeded.get("/api/people").json()}
    m = seeded.post("/api/meetings", json={"transcript_text": "Speaker 1: hi\nSpeaker 2: hello"}).json()
    sp1 = m["participants"][0]
    res = seeded.patch(f"/api/meetings/{m['id']}", json={"participants": [{"id": sp1["id"], "person_id": people["Tom Becker"]}]})
    assert res.json()["participants"][0]["name"] == "Tom Becker"
    assert seeded.get(f"/api/meetings?participant_id={people['Tom Becker']}").json()["total"] >= 2


def test_patch_participant_errors(client):
    m = client.post("/api/meetings", json={"transcript_text": "Alice: hi\nBob: hello"}).json()
    alice, bob = m["participants"]
    url = f"/api/meetings/{m['id']}"
    conflict = client.patch(url, json={"participants": [{"id": bob["id"], "person_id": alice["person_id"]}]})
    assert conflict.status_code == 409 and conflict.json()["code"] == "participant_conflict"
    assert client.patch(url, json={"participants": [{"id": 99999, "name": "X"}]}).json()["code"] == "unknown_participant"
    assert client.patch(url, json={"participants": [{"id": bob["id"], "person_id": 99999}]}).json()["code"] == "unknown_person"
    assert client.patch(url, json={"participants": [{"id": bob["id"]}]}).status_code == 422
    assert client.patch(url, json={"participants": [{"id": bob["id"], "name": "X", "email": "not-an-email"}]}).status_code == 422
    # a failed update leaves no partial change behind
    assert [p["name"] for p in client.get(url).json()["participants"]] == ["Alice", "Bob"]


def test_patch_validation_and_404(client):
    m = client.post("/api/meetings", json={"transcript_text": "Alice: hi"}).json()
    assert client.patch(f"/api/meetings/{m['id']}", json={"title": "   "}).status_code == 422
    assert client.patch(f"/api/meetings/{m['id']}", json={"title": "x" * 300}).status_code == 422
    assert client.patch(f"/api/meetings/{m['id']}", json={"tags": ["x" * 61]}).status_code == 422
    assert client.patch("/api/meetings/999", json={"title": "x"}).status_code == 404


# ---------------------------------------------------------------- delete

def test_delete_cascades_and_removes_search_hits(seeded):
    mid = ids(seeded.get("/api/meetings?q=kafka"))[0]
    item_id = seeded.get(f"/api/meetings/{mid}").json()["action_items"][0]["id"]
    assert seeded.get("/api/search?q=kafka").json()["total"] > 0

    assert seeded.delete(f"/api/meetings/{mid}").status_code == 204
    assert seeded.get(f"/api/meetings/{mid}").status_code == 404
    assert seeded.get(f"/api/meetings/{mid}/transcript").status_code == 404
    assert seeded.patch(f"/api/action-items/{item_id}", json={"is_completed": True}).status_code == 404
    assert seeded.get("/api/search?q=kafka").json()["total"] == 0  # FTS triggers fired
    assert seeded.get("/api/meetings").json()["total"] == 6
    assert any(p["name"] == "Ravi Shankar" for p in seeded.get("/api/people").json()) is False
    assert seeded.delete(f"/api/meetings/{mid}").status_code == 404  # not idempotent-by-200
