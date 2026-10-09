import pytest


@pytest.fixture()
def meeting(seeded):
    mid = seeded.get("/api/meetings?q=standup").json()["items"][0]["id"]
    return seeded.get(f"/api/meetings/{mid}").json()


def test_create_with_assignee_due_date_and_source(seeded, meeting):
    dmitri = next(p for p in meeting["participants"] if p["speaker_label"] == "Dmitri")
    seg = seeded.get(f"/api/meetings/{meeting['id']}/transcript").json()["segments"][7]
    res = seeded.post(f"/api/meetings/{meeting['id']}/action-items", json={
        "text": "  Review   the alert thresholds ", "assignee_participant_id": dmitri["id"],
        "due_date": "2026-10-20", "source_segment_id": seg["id"],
    })
    assert res.status_code == 201
    item = res.json()
    assert item["text"] == "Review the alert thresholds"
    assert item["assignee"]["name"] == "Dmitri Volkov" and item["due_date"] == "2026-10-20"
    assert item["source_start_ms"] == seg["start_ms"]
    assert item["is_completed"] is False and item["completed_at"] is None
    assert item["id"] in [a["id"] for a in seeded.get(f"/api/meetings/{meeting['id']}").json()["action_items"]]


def test_create_minimal(seeded, meeting):
    item = seeded.post(f"/api/meetings/{meeting['id']}/action-items", json={"text": "Just a note"}).json()
    assert item["assignee"] is None and item["due_date"] is None and item["source_segment_id"] is None


def test_create_validation(seeded, meeting):
    url = f"/api/meetings/{meeting['id']}/action-items"
    assert seeded.post(url, json={"text": "   "}).status_code == 422
    assert seeded.post(url, json={}).status_code == 422
    assert seeded.post(url, json={"text": "x" * 1001}).status_code == 422
    assert seeded.post(url, json={"text": "x", "due_date": "soon"}).status_code == 422
    assert seeded.post("/api/meetings/999/action-items", json={"text": "x"}).status_code == 404


def test_assignee_and_segment_must_belong_to_the_same_meeting(seeded, meeting):
    other_id = seeded.get("/api/meetings?q=kafka").json()["items"][0]["id"]
    other = seeded.get(f"/api/meetings/{other_id}").json()
    other_segment = seeded.get(f"/api/meetings/{other_id}/transcript").json()["segments"][0]["id"]
    url = f"/api/meetings/{meeting['id']}/action-items"
    bad_assignee = seeded.post(url, json={"text": "x", "assignee_participant_id": other["participants"][0]["id"]})
    assert (bad_assignee.status_code, bad_assignee.json()["code"]) == (422, "invalid_assignee")
    bad_segment = seeded.post(url, json={"text": "x", "source_segment_id": other_segment})
    assert (bad_segment.status_code, bad_segment.json()["code"]) == (422, "invalid_segment")
    assert seeded.post(url, json={"text": "x", "assignee_participant_id": 99999}).status_code == 422


def test_complete_and_uncomplete_sets_and_clears_completed_at(seeded, meeting):
    item = next(a for a in meeting["action_items"] if not a["is_completed"])
    done = seeded.patch(f"/api/action-items/{item['id']}", json={"is_completed": True}).json()
    assert done["is_completed"] and done["completed_at"].endswith("Z")
    again = seeded.patch(f"/api/action-items/{item['id']}", json={"is_completed": True, "text": "Edited"}).json()
    assert again["completed_at"] == done["completed_at"]  # re-completing doesn't move the timestamp
    reopened = seeded.patch(f"/api/action-items/{item['id']}", json={"is_completed": False}).json()
    assert reopened["is_completed"] is False and reopened["completed_at"] is None
    assert reopened["text"] == "Edited"


def test_patch_only_changes_fields_that_were_sent(seeded, meeting):
    item = next(a for a in meeting["action_items"] if a["assignee"] and a["due_date"])
    res = seeded.patch(f"/api/action-items/{item['id']}", json={"text": "New text"}).json()
    assert res["text"] == "New text"
    assert res["assignee"] == item["assignee"] and res["due_date"] == item["due_date"]
    assert res["is_completed"] == item["is_completed"]


def test_explicit_null_clears_assignee_and_due_date(seeded, meeting):
    item = next(a for a in meeting["action_items"] if a["assignee"] and a["due_date"])
    res = seeded.patch(f"/api/action-items/{item['id']}", json={"assignee_participant_id": None, "due_date": None}).json()
    assert res["assignee"] is None and res["assignee_participant_id"] is None and res["due_date"] is None


def test_reassign_and_validate_assignee(seeded, meeting):
    item = meeting["action_items"][0]
    sofia = next(p for p in meeting["participants"] if p["speaker_label"] == "Sofia")
    assert seeded.patch(f"/api/action-items/{item['id']}", json={"assignee_participant_id": sofia["id"]}).json()["assignee"]["name"] == "Sofia Alvarez"
    assert seeded.patch(f"/api/action-items/{item['id']}", json={"assignee_participant_id": 99999}).status_code == 422


def test_patch_validation_and_404(seeded, meeting):
    item_id = meeting["action_items"][0]["id"]
    assert seeded.patch(f"/api/action-items/{item_id}", json={"text": "  "}).status_code == 422
    assert seeded.patch(f"/api/action-items/{item_id}", json={"is_completed": "maybe"}).status_code == 422
    missing = seeded.patch("/api/action-items/99999", json={"text": "x"})
    assert missing.status_code == 404 and missing.json() == {"detail": "Action item not found", "code": "not_found"}


def test_delete(seeded, meeting):
    item_id = meeting["action_items"][0]["id"]
    assert seeded.delete(f"/api/action-items/{item_id}").status_code == 204
    assert seeded.delete(f"/api/action-items/{item_id}").status_code == 404
    remaining = [a["id"] for a in seeded.get(f"/api/meetings/{meeting['id']}").json()["action_items"]]
    assert item_id not in remaining and len(remaining) == len(meeting["action_items"]) - 1


def test_open_counts_in_list_follow_edits(seeded, meeting):
    def counts():
        m = next(i for i in seeded.get("/api/meetings?q=standup").json()["items"])
        return m["action_items_total"], m["action_items_open"]

    total, open_before = counts()
    seeded.post(f"/api/meetings/{meeting['id']}/action-items", json={"text": "new one"})
    assert counts() == (total + 1, open_before + 1)
