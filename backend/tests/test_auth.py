import pytest

from app.config import settings
from app.security import create_token
from app.services import auth_service
from app.services.throttle import login_throttle
from tests.helpers import PASSWORD, add_meeting, signup


@pytest.fixture(autouse=True)
def fresh_throttle():
    login_throttle._failures.clear()


# ---------------------------------------------------------------- config & signup

def test_auth_config_describes_what_the_login_screen_can_offer(anon_client, monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "abc.apps.googleusercontent.com")
    body = anon_client.get("/api/auth/config").json()
    assert body == {"google_client_id": "abc.apps.googleusercontent.com", "demo_login_enabled": True, "email_transport": "log", "ai_model": None, "can_transcribe": False}
    monkeypatch.setattr(settings, "llm_api_key", "k")
    monkeypatch.setattr(settings, "llm_model", "some/model")
    assert anon_client.get("/api/auth/config").json()["ai_model"] == "some/model"


def test_signup_returns_a_working_token_and_a_sample_meeting(anon_client):
    res = anon_client.post("/api/auth/signup", json={"name": "  Ada   Lovelace ", "email": "ADA@Example.com", "password": PASSWORD})
    assert res.status_code == 201
    body = res.json()
    assert body["user"]["name"] == "Ada Lovelace" and body["user"]["email"] == "ada@example.com"
    assert body["user"]["has_password"] is True and body["user"]["is_demo"] is False
    assert "password" not in str(body).lower().replace("has_password", "")

    headers = {"Authorization": f"Bearer {body['token']}"}
    assert anon_client.get("/api/me", headers=headers).json()["email"] == "ada@example.com"
    meetings = anon_client.get("/api/meetings", headers=headers).json()
    assert [m["title"] for m in meetings["items"]] == ["Sample: Engineering Daily Standup"]
    assert [t["name"] for t in anon_client.get("/api/tags", headers=headers).json()] == ["sample"]


def test_signup_sends_a_welcome_email(anon_client):
    headers = signup(anon_client)
    emails = anon_client.get("/api/emails", headers=headers).json()
    assert [(e["subject"], e["to_email"], e["status"]) for e in emails] == [("Welcome to Fireflies Clone", "ada@example.com", "logged")]


@pytest.mark.parametrize(
    "payload, field",
    [
        ({"name": "A", "email": "a@x.com", "password": "short"}, "password"),
        ({"name": "A", "email": "not-an-email", "password": PASSWORD}, "email"),
        ({"name": "   ", "email": "a@x.com", "password": PASSWORD}, "name"),
        ({"name": "A", "email": "a@x.com"}, "password"),
    ],
)
def test_signup_validation(anon_client, payload, field):
    res = anon_client.post("/api/auth/signup", json=payload)
    assert res.status_code == 422 and field in res.json()["detail"]


def test_duplicate_email_is_a_409_regardless_of_case(anon_client):
    signup(anon_client, "ada@example.com")
    res = anon_client.post("/api/auth/signup", json={"name": "Other", "email": "ADA@EXAMPLE.COM", "password": PASSWORD})
    assert (res.status_code, res.json()["code"]) == (409, "email_taken")


# ---------------------------------------------------------------- login

def test_login_with_the_right_password(anon_client):
    signup(anon_client)
    res = anon_client.post("/api/auth/login", json={"email": "Ada@example.com", "password": PASSWORD})
    assert res.status_code == 200 and res.json()["user"]["email"] == "ada@example.com"


def test_wrong_password_and_unknown_email_look_identical(anon_client):
    signup(anon_client)
    wrong = anon_client.post("/api/auth/login", json={"email": "ada@example.com", "password": "nope-nope-nope"})
    unknown = anon_client.post("/api/auth/login", json={"email": "ghost@example.com", "password": "nope-nope-nope"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json() == {"detail": "Incorrect email or password.", "code": "invalid_credentials"}


def test_repeated_failures_are_throttled_then_cleared_by_success_elsewhere(anon_client):
    signup(anon_client)
    bad = {"email": "ada@example.com", "password": "wrong-wrong-wrong"}
    assert [anon_client.post("/api/auth/login", json=bad).status_code for _ in range(5)] == [401] * 5
    blocked = anon_client.post("/api/auth/login", json=bad)
    assert (blocked.status_code, blocked.json()["code"]) == (429, "too_many_attempts")
    # even the right password is refused while blocked
    assert anon_client.post("/api/auth/login", json={"email": "ada@example.com", "password": PASSWORD}).status_code == 429
    # a different email is unaffected
    assert anon_client.post("/api/auth/login", json={"email": "other@example.com", "password": "x" * 10}).status_code == 401


def test_throttle_expires_with_time():
    from app.services.throttle import FailureThrottle

    now = [0.0]
    t = FailureThrottle(max_failures=2, window_seconds=60, clock=lambda: now[0])
    t.record_failure("k"); t.record_failure("k")
    assert t.blocked("k")
    now[0] = 61
    assert not t.blocked("k")


# ---------------------------------------------------------------- tokens

def test_protected_routes_need_a_valid_token(anon_client):
    assert anon_client.get("/api/me").json() == {"detail": "Log in to continue.", "code": "not_authenticated"}
    res = anon_client.get("/api/meetings", headers={"Authorization": "Bearer garbage"})
    assert (res.status_code, res.json()["code"]) == (401, "invalid_token")
    assert anon_client.get("/api/health").status_code == 200  # public


def test_expired_and_wrong_purpose_tokens_are_rejected(anon_client):
    from datetime import timedelta

    headers = signup(anon_client)
    user_id = anon_client.get("/api/me", headers=headers).json()["id"]
    expired = create_token(user_id, expires=timedelta(seconds=-5))
    reset_token = create_token(user_id, purpose="reset")
    for token in (expired, reset_token):
        assert anon_client.get("/api/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_a_token_for_a_deleted_user_is_rejected(anon_client):
    headers = signup(anon_client)
    assert anon_client.request("DELETE", "/api/me", headers=headers, json={"password": PASSWORD}).status_code == 204
    assert anon_client.get("/api/me", headers=headers).status_code == 401


# ---------------------------------------------------------------- demo

def test_demo_login_opens_the_prefilled_account(anon_client, seeded):
    res = anon_client.post("/api/auth/demo")
    assert res.status_code == 200 and res.json()["user"]["is_demo"] is True
    headers = {"Authorization": f"Bearer {res.json()['token']}"}
    assert anon_client.get("/api/meetings", headers=headers).json()["total"] == 7


def test_demo_login_can_be_disabled(anon_client, monkeypatch):
    monkeypatch.setattr(settings, "demo_login_enabled", False)
    assert anon_client.post("/api/auth/demo").json()["code"] == "demo_disabled"


def test_the_demo_account_cannot_be_deleted_or_logged_into_with_a_password(anon_client, seeded):
    token = anon_client.post("/api/auth/demo").json()["token"]
    res = anon_client.request("DELETE", "/api/me", headers={"Authorization": f"Bearer {token}"}, json={})
    assert (res.status_code, res.json()["code"]) == (403, "demo_protected")
    assert anon_client.post("/api/auth/login", json={"email": "alex.morgan@lumenly.io", "password": "anything-at-all"}).status_code == 401


# ---------------------------------------------------------------- isolation between accounts

def test_accounts_cannot_see_each_others_data(anon_client):
    ada, bob = signup(anon_client, "ada@example.com"), signup(anon_client, "bob@example.com", name="Bob")
    secret = add_meeting(anon_client, ada, "Ada's secret roadmap")
    item = secret["action_items"][0]

    assert [m["title"] for m in anon_client.get("/api/meetings", headers=bob).json()["items"]] == ["Sample: Engineering Daily Standup"]
    for method, url in [("get", f"/api/meetings/{secret['id']}"), ("get", f"/api/meetings/{secret['id']}/transcript"),
                        ("get", f"/api/meetings/{secret['id']}/export"), ("delete", f"/api/meetings/{secret['id']}"),
                        ("post", f"/api/meetings/{secret['id']}/summary/regenerate"), ("delete", f"/api/action-items/{item['id']}")]:
        assert getattr(anon_client, method)(url, headers=bob).status_code == 404, url
    assert anon_client.patch(f"/api/action-items/{item['id']}", headers=bob, json={"is_completed": True}).status_code == 404
    assert anon_client.post(f"/api/meetings/{secret['id']}/action-items", headers=bob, json={"text": "x"}).status_code == 404
    assert anon_client.patch(f"/api/meetings/{secret['id']}", headers=bob, json={"title": "pwned"}).status_code == 404
    assert anon_client.get("/api/search?q=roadmap", headers=bob).json()["total"] == 0
    assert anon_client.get("/api/search?q=roadmap", headers=ada).json()["total"] == 0  # title isn't transcript text
    assert anon_client.get("/api/search?q=report", headers=bob).json()["total"] == 0
    assert anon_client.get("/api/search?q=report", headers=ada).json()["total"] > 0


def test_people_and_tags_are_private_per_account(anon_client):
    ada, bob = signup(anon_client, "ada@example.com"), signup(anon_client, "bob@example.com", name="Bob")
    mine = add_meeting(anon_client, ada, "Mine")
    anon_client.patch(f"/api/meetings/{mine['id']}", headers=ada, json={"tags": ["roadmap"]})
    assert "roadmap" in [t["name"] for t in anon_client.get("/api/tags", headers=ada).json()]
    assert "roadmap" not in [t["name"] for t in anon_client.get("/api/tags", headers=bob).json()]
    assert "Alice" in [p["name"] for p in anon_client.get("/api/people", headers=ada).json()]
    assert "Alice" not in [p["name"] for p in anon_client.get("/api/people", headers=bob).json()]
    # the same tag name can exist independently in both accounts
    theirs = add_meeting(anon_client, bob, "Theirs")
    assert anon_client.patch(f"/api/meetings/{theirs['id']}", headers=bob, json={"tags": ["roadmap"]}).status_code == 200
    assert {t["meeting_count"] for t in anon_client.get("/api/tags", headers=bob).json() if t["name"] == "roadmap"} == {1}


def test_cannot_point_a_speaker_at_someone_elses_person(anon_client):
    ada, bob = signup(anon_client, "ada@example.com"), signup(anon_client, "bob@example.com", name="Bob")
    ada_person = anon_client.get("/api/people", headers=ada).json()[0]["id"]
    meeting = add_meeting(anon_client, bob)
    res = anon_client.patch(f"/api/meetings/{meeting['id']}", headers=bob, json={"participants": [{"id": meeting["participants"][0]["id"], "person_id": ada_person}]})
    assert (res.status_code, res.json()["code"]) == (422, "unknown_person")


def test_deleting_a_meeting_removes_people_who_no_longer_appear_anywhere(anon_client):
    ada = signup(anon_client)
    meeting = add_meeting(anon_client, ada)
    names = {p["name"] for p in anon_client.get("/api/people", headers=ada).json()}
    assert {"Alice", "Bob"} <= names
    anon_client.delete(f"/api/meetings/{meeting['id']}", headers=ada)
    names = {p["name"] for p in anon_client.get("/api/people", headers=ada).json()}
    assert "Alice" not in names and "Bob" not in names


# ---------------------------------------------------------------- password reset

def _reset_link(anon_client, headers) -> str:
    emails = anon_client.get("/api/emails", headers=headers).json()
    reset = next(e for e in emails if e["subject"] == "Reset your password")
    text = anon_client.get(f"/api/emails/{reset['id']}", headers=headers).json()["text"]
    return text.split("reset-password?token=")[1].split()[0]


def test_forgot_password_answers_the_same_for_any_address(anon_client):
    signup(anon_client)
    known = anon_client.post("/api/auth/forgot-password", json={"email": "ada@example.com"})
    unknown = anon_client.post("/api/auth/forgot-password", json={"email": "ghost@example.com"})
    assert known.status_code == unknown.status_code == 200 and known.json() == unknown.json()


def test_reset_flow_changes_the_password_and_the_link_works_once(anon_client):
    headers = signup(anon_client)
    anon_client.post("/api/auth/forgot-password", json={"email": "ada@example.com"})
    token = _reset_link(anon_client, headers)

    res = anon_client.post("/api/auth/reset-password", json={"token": token, "password": "brand-new-password"})
    assert res.status_code == 200 and res.json()["user"]["email"] == "ada@example.com"
    assert anon_client.post("/api/auth/login", json={"email": "ada@example.com", "password": "brand-new-password"}).status_code == 200
    assert anon_client.post("/api/auth/login", json={"email": "ada@example.com", "password": PASSWORD}).status_code == 401
    again = anon_client.post("/api/auth/reset-password", json={"token": token, "password": "yet-another-password"})
    assert (again.status_code, again.json()["code"]) == (400, "invalid_reset_token")


def test_reset_rejects_garbage_and_access_tokens_and_weak_passwords(anon_client):
    headers = signup(anon_client)
    access = headers["Authorization"].split()[1]
    for token in ("x" * 20, access):
        assert anon_client.post("/api/auth/reset-password", json={"token": token, "password": "long-enough-pw"}).json()["code"] == "invalid_reset_token"
    anon_client.post("/api/auth/forgot-password", json={"email": "ada@example.com"})
    good = _reset_link(anon_client, headers)
    assert anon_client.post("/api/auth/reset-password", json={"token": good, "password": "short"}).status_code == 422


# ---------------------------------------------------------------- profile, password, deletion

def test_update_profile(anon_client):
    headers = signup(anon_client)
    res = anon_client.patch("/api/me", headers=headers, json={"name": "  Ada  King "})
    assert res.json()["name"] == "Ada King"
    assert anon_client.patch("/api/me", headers=headers, json={"avatar_url": "http://insecure.example/a.png"}).status_code == 422
    ok = anon_client.patch("/api/me", headers=headers, json={"avatar_url": "https://example.com/a.png"}).json()
    assert ok["avatar_url"] == "https://example.com/a.png" and ok["name"] == "Ada King"
    assert anon_client.patch("/api/me", headers=headers, json={"avatar_url": None}).json()["avatar_url"] is None


def test_change_password(anon_client):
    headers = signup(anon_client)
    wrong = anon_client.post("/api/me/password", headers=headers, json={"current_password": "not-it-at-all", "new_password": "another-good-one"})
    assert (wrong.status_code, wrong.json()["code"]) == (400, "wrong_password")
    assert anon_client.post("/api/me/password", headers=headers, json={"current_password": PASSWORD, "new_password": "another-good-one"}).status_code == 200
    assert anon_client.post("/api/auth/login", json={"email": "ada@example.com", "password": "another-good-one"}).status_code == 200


def test_delete_account_requires_the_password_and_removes_everything(anon_client, session_factory):
    from sqlalchemy import func, select
    from app.models import Meeting, Person, User

    headers = signup(anon_client)
    add_meeting(anon_client, headers)
    assert anon_client.request("DELETE", "/api/me", headers=headers, json={"password": "wrong-wrong-wrong"}).json()["code"] == "wrong_password"
    assert anon_client.request("DELETE", "/api/me", headers=headers, json={"password": PASSWORD}).status_code == 204
    with session_factory() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 0
        assert db.scalar(select(func.count()).select_from(Meeting)) == 0
        assert db.scalar(select(func.count()).select_from(Person)) == 0
    assert anon_client.post("/api/auth/login", json={"email": "ada@example.com", "password": PASSWORD}).status_code == 401


# ---------------------------------------------------------------- google

def test_google_sign_in_creates_and_then_reuses_an_account(anon_client, monkeypatch):
    monkeypatch.setattr(settings, "google_client_id", "cid")
    claims = {"sub": "g-123", "email": "Grace@Example.com", "name": "Grace Hopper", "picture": "https://example.com/g.png"}
    monkeypatch.setattr(auth_service, "verify_google_credential", lambda credential: claims)
    first = anon_client.post("/api/auth/google", json={"credential": "x" * 20})
    assert first.status_code == 200 and first.json()["user"]["email"] == "grace@example.com"
    assert first.json()["user"]["has_password"] is False
    second = anon_client.post("/api/auth/google", json={"credential": "x" * 20})
    assert second.json()["user"]["id"] == first.json()["user"]["id"]


def test_google_sign_in_links_to_an_existing_password_account(anon_client, monkeypatch):
    signup(anon_client, "grace@example.com", name="Grace")
    monkeypatch.setattr(settings, "google_client_id", "cid")
    monkeypatch.setattr(auth_service, "verify_google_credential", lambda c: {"sub": "g-9", "email": "grace@example.com", "name": "Grace"})
    res = anon_client.post("/api/auth/google", json={"credential": "x" * 20})
    assert res.json()["user"]["has_password"] is True  # same account, now also reachable via Google
    assert anon_client.post("/api/auth/login", json={"email": "grace@example.com", "password": PASSWORD}).status_code == 200


def test_google_sign_in_is_unavailable_until_configured(anon_client):
    res = anon_client.post("/api/auth/google", json={"credential": "x" * 20})
    assert (res.status_code, res.json()["code"]) == (501, "google_not_configured")


@pytest.mark.parametrize("claims", [{"aud": "someone-else", "email_verified": True}, {"aud": "cid", "email_verified": False}])
def test_google_tokens_for_another_app_or_unverified_email_are_refused(monkeypatch, claims):
    import io, json
    monkeypatch.setattr(settings, "google_client_id", "cid")
    monkeypatch.setattr("urllib.request.urlopen", lambda *a, **k: io.BytesIO(json.dumps({"sub": "1", "email": "a@b.com", **claims}).encode()))
    with pytest.raises(Exception) as err:
        auth_service.verify_google_credential("x" * 20)
    assert getattr(err.value, "code", None) == "invalid_google_token"


def test_validation_messages_are_written_for_people_not_for_pydantic(anon_client):
    res = anon_client.post("/api/auth/signup", json={"name": "", "email": "nope", "password": "x"})
    assert res.status_code == 422
    assert res.json()["detail"] == (
        "name: This field is required; email: Enter a valid email address; password: Password must be at least 8 characters"
    )
    missing = anon_client.post("/api/auth/signup", json={"email": "a@b.com", "password": "long-enough-pw"})
    assert missing.json()["detail"] == "name: This field is required"
    assert "Value error" not in anon_client.post("/api/auth/login", json={"email": "bad", "password": "x"}).json()["detail"]
