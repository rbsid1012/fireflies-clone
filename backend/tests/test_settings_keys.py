from datetime import datetime, timedelta, timezone

from tests.helpers import PASSWORD, add_meeting, signup


# ---------------------------------------------------------------- settings

def test_defaults_cover_every_section(anon_client):
    headers = signup(anon_client)
    cfg = anon_client.get("/api/settings", headers=headers).json()
    assert set(cfg) == {"appearance", "recording", "compliance", "email", "ai", "knowledge_base", "team"}
    assert cfg["appearance"] == {"theme": "dark"} and cfg["email"] == {"recap_recipients": "me", "recap_include": "overview"}
    assert cfg["recording"] == {"meeting_language": "en", "auto_delete_days": None} and cfg["ai"]["summary_style"] == "balanced"
    assert cfg["compliance"]["notify_participants"] is True


def test_patch_merges_field_by_field_and_persists(anon_client):
    headers = signup(anon_client)
    res = anon_client.patch("/api/settings", headers=headers, json={"appearance": {"theme": "light"}, "email": {"recap_include": "full"}})
    assert res.status_code == 200
    again = anon_client.get("/api/settings", headers=headers).json()
    assert again["appearance"] == {"theme": "light"}
    assert again["email"] == {"recap_recipients": "me", "recap_include": "full"}  # the other field in the section is kept
    anon_client.patch("/api/settings", headers=headers, json={"recording": {"meeting_language": "fr"}})
    anon_client.patch("/api/settings", headers=headers, json={"recording": {"auto_delete_days": 30}})
    assert anon_client.get("/api/settings", headers=headers).json()["recording"] == {"meeting_language": "fr", "auto_delete_days": 30}
    anon_client.patch("/api/settings", headers=headers, json={"recording": {"auto_delete_days": None}})  # null turns retention off
    assert anon_client.get("/api/settings", headers=headers).json()["recording"]["auto_delete_days"] is None


def test_invalid_settings_are_rejected_whole(anon_client):
    headers = signup(anon_client)
    for body in [
        {"appearance": {"theme": "neon"}}, {"appearance": {"colour": "red"}}, {"nope": {}},
        {"recording": {"auto_delete_days": 0}}, {"recording": {"meeting_language": "klingon"}},
        {"ai": {"custom_instructions": "x" * 1001}}, {"email": {"recap_recipients": "everyone"}},
        {"live_assist": {"enabled": True}},  # a setting this app doesn't have
    ]:
        assert anon_client.patch("/api/settings", headers=headers, json=body).status_code == 422, body
    unknown = anon_client.patch("/api/settings", headers=headers, json={"appearance": {"colour": "red"}}).json()
    assert unknown["detail"] == "appearance.colour: Unknown setting"
    assert anon_client.get("/api/settings", headers=headers).json()["appearance"]["theme"] == "dark"  # nothing half-applied
    mixed = anon_client.patch("/api/settings", headers=headers, json={"appearance": {"theme": "light"}, "email": {"recap_include": "bogus"}})
    assert mixed.status_code == 422
    assert anon_client.get("/api/settings", headers=headers).json()["appearance"]["theme"] == "dark"


def test_stored_settings_with_retired_keys_still_load(anon_client, session_factory):
    from sqlalchemy import select
    from app.models import User

    headers = signup(anon_client)
    with session_factory() as db:
        user = db.scalar(select(User).where(User.email == "ada@example.com"))
        user.settings = {"appearance": {"theme": "light", "time_format": "24h"}, "live_assist": {"enabled": True}, "email": {"recap_include": "full", "prep_recipients": "me"}}
        db.commit()
    cfg = anon_client.get("/api/settings", headers=headers).json()
    assert cfg["appearance"] == {"theme": "light"} and cfg["email"]["recap_include"] == "full"  # valid parts survive, retired keys are dropped


def test_settings_are_per_account(anon_client):
    a, b = signup(anon_client, "a@example.com"), signup(anon_client, "b@example.com", name="B")
    anon_client.patch("/api/settings", headers=a, json={"appearance": {"theme": "light"}})
    assert anon_client.get("/api/settings", headers=b).json()["appearance"]["theme"] == "dark"


def test_a_new_retention_rule_deletes_old_meetings_immediately(anon_client):
    headers = signup(anon_client)
    old_date = (datetime.now(timezone.utc) - timedelta(days=100)).isoformat()
    old = add_meeting(anon_client, headers, "Ancient", started_at=old_date)
    recent = add_meeting(anon_client, headers, "Recent")
    anon_client.patch("/api/settings", headers=headers, json={"recording": {"auto_delete_days": 30}})
    titles = [m["title"] for m in anon_client.get("/api/meetings", headers=headers).json()["items"]]
    assert "Ancient" not in titles and "Recent" in titles
    assert anon_client.get(f"/api/meetings/{old['id']}", headers=headers).status_code == 404
    assert anon_client.get(f"/api/meetings/{recent['id']}", headers=headers).status_code == 200


def test_retention_runs_at_login_too(anon_client, session_factory):
    from sqlalchemy import select
    from app.models import Meeting

    headers = signup(anon_client)
    anon_client.patch("/api/settings", headers=headers, json={"recording": {"auto_delete_days": 30}})
    add_meeting(anon_client, headers, "Ancient", started_at=(datetime.now(timezone.utc) - timedelta(days=45)).isoformat())
    # created after the rule, so it is still present until the next sweep
    assert "Ancient" in [m["title"] for m in anon_client.get("/api/meetings", headers=headers).json()["items"]]
    login = anon_client.post("/api/auth/login", json={"email": "ada@example.com", "password": PASSWORD})
    assert login.status_code == 200
    with session_factory() as db:
        assert "Ancient" not in [m.title for m in db.scalars(select(Meeting))]


def test_security_overview_reflects_account_state(anon_client):
    headers = signup(anon_client)
    first = anon_client.get("/api/settings/security", headers=headers).json()
    assert (first["done"], first["total"]) == (2, 3)  # password + no stale keys; retention not set
    assert {c["id"]: c["done"] for c in first["checks"]} == {"sign_in": True, "retention": False, "api_keys": True}
    anon_client.patch("/api/settings", headers=headers, json={"recording": {"auto_delete_days": 90}})
    assert anon_client.get("/api/settings/security", headers=headers).json()["done"] == 3


# ---------------------------------------------------------------- API keys

def test_api_key_lifecycle(anon_client):
    headers = signup(anon_client)
    created = anon_client.post("/api/api-keys", headers=headers, json={"name": "  CI   script "})
    assert created.status_code == 201
    body = created.json()
    key = body["key"]
    assert key.startswith("ffk_") and body["name"] == "CI script" and body["prefix"] == key[:12]

    listed = anon_client.get("/api/api-keys", headers=headers).json()
    assert [k["id"] for k in listed] == [body["id"]]
    assert "key" not in listed[0] and key not in str(listed)  # the secret is shown once only

    bearer = {"Authorization": f"Bearer {key}"}
    assert anon_client.get("/api/me", headers=bearer).json()["email"] == "ada@example.com"
    assert anon_client.get("/api/meetings", headers=bearer).status_code == 200
    assert anon_client.get("/api/api-keys", headers=headers).json()[0]["last_used_at"] is not None

    assert anon_client.delete(f"/api/api-keys/{body['id']}", headers=headers).status_code == 204
    assert anon_client.get("/api/me", headers=bearer).status_code == 401  # revoked
    assert anon_client.delete(f"/api/api-keys/{body['id']}", headers=headers).status_code == 404


def test_api_keys_are_per_account_and_capped(anon_client):
    a, b = signup(anon_client, "a@example.com"), signup(anon_client, "b@example.com", name="B")
    key_id = anon_client.post("/api/api-keys", headers=a, json={"name": "mine"}).json()["id"]
    assert anon_client.get("/api/api-keys", headers=b).json() == []
    assert anon_client.delete(f"/api/api-keys/{key_id}", headers=b).status_code == 404
    for i in range(9):
        assert anon_client.post("/api/api-keys", headers=a, json={"name": f"k{i}"}).status_code == 201
    over = anon_client.post("/api/api-keys", headers=a, json={"name": "one too many"})
    assert (over.status_code, over.json()["code"]) == (409, "too_many_keys")


def test_malformed_keys_are_rejected(anon_client):
    for token in ("ffk_" + "x" * 30, "ffk_", "ffk_a.b.c"):
        assert anon_client.get("/api/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


# ---------------------------------------------------------------- AI settings change how summaries are made

LONG = "\n".join(f"[00:{m:02d}:00] Alice: Topic {m} gets its own long discussion sentence number {m} about subject{m} today." for m in range(1, 11))


def test_summary_style_changes_overview_length(anon_client):
    headers = signup(anon_client)
    sentences = {}
    for style in ("concise", "detailed"):
        anon_client.patch("/api/settings", headers=headers, json={"ai": {"summary_style": style}})
        m = add_meeting(anon_client, headers, style, transcript_text=LONG)
        sentences[style] = m["summary"]["overview"].count("discussion sentence")
    assert sentences["concise"] == 3 and sentences["detailed"] > sentences["concise"]


def test_action_item_extraction_can_be_switched_off(anon_client):
    headers = signup(anon_client)
    assert add_meeting(anon_client, headers, "on")["action_items"]
    anon_client.patch("/api/settings", headers=headers, json={"ai": {"extract_action_items": False}})
    assert add_meeting(anon_client, headers, "off")["action_items"] == []


def test_ai_preferences_are_sent_to_the_model_for_summaries(anon_client, llm_holder):
    from tests.fakes import FakeLLM

    headers = signup(anon_client)
    anon_client.patch("/api/settings", headers=headers, json={"ai": {"summary_style": "concise", "custom_instructions": "Mention budget impact."}})
    fake = llm_holder["llm"] = FakeLLM('{"overview": "ok", "keywords": [], "chapters": [], "action_items": []}')
    add_meeting(anon_client, headers)
    system = fake.calls[0][0]
    assert "2-3 sentences" in system and "Mention budget impact." in system


def test_team_defaults_are_saved_validated_and_do_not_touch_personal_settings(anon_client):
    headers = signup(anon_client)
    cfg = anon_client.get("/api/settings", headers=headers).json()
    assert cfg["team"]["auto_record"] == "choose" and cfg["team"]["personal_assistant"] == "on"
    saved = anon_client.patch("/api/settings", headers=headers, json={"team": {"auto_record": "off", "meeting_privacy": "on"}}).json()
    assert saved["team"]["auto_record"] == "off" and saved["team"]["meeting_privacy"] == "on" and saved["team"]["capture_video"] == "choose"
    assert saved["recording"] == cfg["recording"] and saved["email"] == cfg["email"]
    assert anon_client.patch("/api/settings", headers=headers, json={"team": {"auto_record": "sometimes"}}).status_code == 422
    assert anon_client.patch("/api/settings", headers=headers, json={"team": {"bogus": "on"}}).status_code == 422
    assert anon_client.get("/api/settings", headers=headers).json()["team"]["auto_record"] == "off"
