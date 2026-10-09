from tests.helpers import add_meeting, signup


def meeting_id(c, q):
    return c.get(f"/api/meetings?q={q}").json()["items"][0]["id"]


def lines(c, mid):
    return c.get(f"/api/meetings/{mid}/transcript").json()["segments"]


def test_seeded_soundbites_are_listed_with_text_and_times(seeded):
    mid = meeting_id(seeded, "interview")
    items = seeded.get(f"/api/meetings/{mid}/soundbites").json()["items"]
    assert items and all(i["text"] and i["end_ms"] > i["start_ms"] for i in items)
    assert [i["start_ms"] for i in items] == sorted(i["start_ms"] for i in items)


def test_create_edit_and_delete_a_soundbite(seeded):
    mid = meeting_id(seeded, "standup")
    segs = lines(seeded, mid)
    made = seeded.post(f"/api/meetings/{mid}/soundbites", json={"start_segment_id": segs[2]["id"], "end_segment_id": segs[4]["id"], "note": "  Freeze   date "})
    assert made.status_code == 201
    sb = made.json()
    assert sb["note"] == "Freeze date" and sb["start_ms"] == segs[2]["start_ms"] and sb["end_ms"] == segs[4]["end_ms"]
    assert segs[3]["text"] in sb["text"] and sb["speaker_name"] == segs[2]["speaker_name"]

    one = seeded.post(f"/api/meetings/{mid}/soundbites", json={"start_segment_id": segs[0]["id"]}).json()
    assert one["end_segment_id"] == segs[0]["id"] and one["note"] == ""

    assert seeded.patch(f"/api/soundbites/{sb['id']}", json={"note": "Decision"}).json()["note"] == "Decision"
    assert seeded.delete(f"/api/soundbites/{sb['id']}").status_code == 204
    assert sb["id"] not in [i["id"] for i in seeded.get(f"/api/meetings/{mid}/soundbites").json()["items"]]
    assert seeded.delete(f"/api/soundbites/{sb['id']}").status_code == 404


def test_ranges_are_validated(seeded):
    mid, other = meeting_id(seeded, "standup"), meeting_id(seeded, "interview")
    segs, foreign = lines(seeded, mid), lines(seeded, other)
    url = f"/api/meetings/{mid}/soundbites"
    assert seeded.post(url, json={"start_segment_id": segs[5]["id"], "end_segment_id": segs[2]["id"]}).status_code == 422
    assert seeded.post(url, json={"start_segment_id": foreign[0]["id"]}).status_code == 422  # another meeting's line
    assert seeded.post(url, json={"start_segment_id": 999999}).status_code == 422
    text = "\n".join(f"[00:{n // 60:02d}:{n % 60:02d}] A: line number {n}" for n in range(40))
    long_id = seeded.post("/api/meetings", json={"title": "Long", "transcript_text": text}).json()["id"]
    long_lines = lines(seeded, long_id)
    too_long = seeded.post(f"/api/meetings/{long_id}/soundbites", json={"start_segment_id": long_lines[0]["id"], "end_segment_id": long_lines[-1]["id"]})
    assert len(long_lines) >= 35 and too_long.status_code == 422
    assert seeded.post(url, json={"start_segment_id": segs[0]["id"], "note": "x" * 501}).status_code == 422


def test_soundbites_are_private_to_their_owner(anon_client):
    ada, bob = signup(anon_client), signup(anon_client, "bob@example.com", name="Bob")
    mine = add_meeting(anon_client, ada, "Private")
    seg = anon_client.get(f"/api/meetings/{mine['id']}/transcript", headers=ada).json()["segments"][0]
    sb = anon_client.post(f"/api/meetings/{mine['id']}/soundbites", headers=ada, json={"start_segment_id": seg["id"]}).json()
    assert anon_client.get(f"/api/meetings/{mine['id']}/soundbites", headers=bob).status_code == 404
    assert anon_client.post(f"/api/meetings/{mine['id']}/soundbites", headers=bob, json={"start_segment_id": seg["id"]}).status_code == 404
    assert anon_client.patch(f"/api/soundbites/{sb['id']}", headers=bob, json={"note": "x"}).status_code == 404
    assert anon_client.delete(f"/api/soundbites/{sb['id']}", headers=bob).status_code == 404
    assert anon_client.get("/api/meetings/1/soundbites").status_code == 401
