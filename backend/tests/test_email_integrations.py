import json

import pytest

from app.config import settings
from app.services import email_service, integration_service
from tests.helpers import add_meeting, signup


def emails(client, headers):
    return client.get("/api/emails", headers=headers).json()


def detail(client, headers, email_id):
    return client.get(f"/api/emails/{email_id}", headers=headers).json()


# ---------------------------------------------------------------- recap emails

def test_a_recap_email_is_sent_when_a_meeting_is_created(anon_client):
    headers = signup(anon_client)
    meeting = add_meeting(anon_client, headers, "Q4 planning")
    recap = [e for e in emails(anon_client, headers) if e["subject"].startswith("Your meeting recap")]
    assert len(recap) == 1
    assert (recap[0]["subject"], recap[0]["to_email"], recap[0]["meeting_id"]) == ("Your meeting recap - Q4 planning", "ada@example.com", meeting["id"])
    full = detail(anon_client, headers, recap[0]["id"])
    assert f"/meetings/{meeting['id']}" in full["text"] and "View meeting recap" in full["html"]
    assert "Meeting notes taken on behalf of ada@example.com" in full["html"]
    assert "Overview" in full["html"]
    assert "ACTION ITEMS" not in full["text"]  # default content is the overview only


@pytest.mark.parametrize("include, expect_actions", [("overview", False), ("overview_actions", True), ("full", True)])
def test_recap_content_follows_the_settings(anon_client, include, expect_actions):
    headers = signup(anon_client)
    anon_client.patch("/api/settings", headers=headers, json={"email": {"recap_include": include}})
    add_meeting(anon_client, headers)
    recap = next(e for e in emails(anon_client, headers) if e["subject"].startswith("Your meeting recap"))
    text = detail(anon_client, headers, recap["id"])["text"]
    assert ("ACTION ITEMS" in text) is expect_actions
    if expect_actions:
        assert "send the draft tomorrow" in text


def test_recap_can_be_turned_off(anon_client):
    headers = signup(anon_client)
    anon_client.patch("/api/settings", headers=headers, json={"email": {"recap_recipients": "none"}})
    add_meeting(anon_client, headers)
    assert [e for e in emails(anon_client, headers) if "recap" in e["subject"]] == []


def test_recap_can_go_to_participants_who_have_an_email(anon_client):
    headers = signup(anon_client)
    anon_client.patch("/api/settings", headers=headers, json={"email": {"recap_recipients": "participants"}})
    transcript = json.dumps([{"speaker": "Alice", "text": "hello there everyone"}, {"speaker": "Bob", "text": "hi"}])
    meeting = add_meeting(anon_client, headers, "Team sync", transcript_text=transcript)
    # Give Alice an address, then create a second meeting so she is a known person with an email
    alice = next(p for p in meeting["participants"] if p["name"] == "Alice")
    anon_client.patch(f"/api/meetings/{meeting['id']}", headers=headers, json={"participants": [{"id": alice["id"], "name": "Alice", "email": "alice@example.com"}]})
    again = add_meeting(anon_client, headers, "Second", transcript_text=transcript)
    recipients = sorted(e["to_email"] for e in emails(anon_client, headers) if e["meeting_id"] == again["id"])
    assert recipients == ["ada@example.com", "alice@example.com"]  # owner + Alice; Bob has no address


def test_email_html_escapes_user_content(anon_client):
    headers = signup(anon_client)
    add_meeting(anon_client, headers, "<script>alert(1)</script> & <b>bold</b>")
    recap = next(e for e in emails(anon_client, headers) if e["subject"].startswith("Your meeting recap"))
    html = detail(anon_client, headers, recap["id"])["html"]
    assert "<script>" not in html and "&lt;script&gt;" in html and "<b>bold</b>" not in html


def test_provider_failures_are_recorded_and_never_break_the_request(anon_client, monkeypatch):
    class Broken:
        name = "smtp"

        def send(self, msg):
            raise ConnectionRefusedError("smtp.example.com refused the connection")

    monkeypatch.setattr(email_service, "get_transport", lambda: Broken())
    headers = signup(anon_client)  # sends a welcome mail through the broken transport
    meeting = add_meeting(anon_client, headers)
    assert meeting["status"] == "ready"
    rows = emails(anon_client, headers)
    assert rows and all(e["status"] == "failed" and "refused" in e["error"] and e["transport"] == "smtp" for e in rows)


def test_a_real_transport_marks_mail_as_sent(anon_client, monkeypatch):
    sent = []

    class Fake:
        name = "resend"

        def send(self, msg):
            sent.append(msg)

    monkeypatch.setattr(email_service, "get_transport", lambda: Fake())
    headers = signup(anon_client)
    assert [e["status"] for e in emails(anon_client, headers)] == ["sent"]
    assert sent[0].to == "ada@example.com" and sent[0].subject == "Welcome to Fireflies Clone" and sent[0].html and sent[0].text


def test_header_injection_in_the_recipient_is_refused(session_factory):
    from app.models import User

    with session_factory() as db:
        user = User(name="U", email="u@example.com")
        db.add(user)
        db.commit()
        row = email_service.send_email(db, user_id=user.id, msg=email_service.OutboundEmail(to="a@b.com\nBcc: x@y.com", subject="s", html="h", text="t"))
        assert row.status == "failed" and "invalid recipient" in row.error


def test_test_email_and_outbox_endpoints(anon_client):
    headers = signup(anon_client)
    res = anon_client.post("/api/settings/email/test", headers=headers)
    assert res.status_code == 201 and res.json()["subject"] == "Test email from Fireflies Clone"
    assert emails(anon_client, headers)[0]["id"] == res.json()["id"]  # newest first
    assert anon_client.get("/api/emails/99999", headers=headers).status_code == 404
    other = signup(anon_client, "other@example.com", name="Other")
    assert anon_client.get(f"/api/emails/{res.json()['id']}", headers=other).status_code == 404  # not yours
    assert anon_client.get("/api/emails?limit=1", headers=headers).json().__len__() == 1


def test_smtp_and_resend_transports_are_chosen_from_configuration(monkeypatch):
    assert settings.email_transport == "log"
    monkeypatch.setattr(settings, "resend_api_key", "re_x")
    assert settings.email_transport == "resend" and email_service.get_transport().name == "resend"
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    assert settings.email_transport == "smtp" and email_service.get_transport().name == "smtp"  # SMTP wins


def test_the_smtp_transport_builds_a_multipart_message(monkeypatch):
    captured = {}

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            captured["conn"] = (host, port)

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def starttls(self):
            captured["tls"] = True

        def login(self, user, password):
            captured["login"] = (user, password)

        def send_message(self, message):
            captured["message"] = message

    monkeypatch.setattr("smtplib.SMTP", FakeSMTP)
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(settings, "smtp_user", "mailer")
    monkeypatch.setattr(settings, "smtp_password", "pw")
    email_service.SmtpTransport().send(email_service.OutboundEmail(to="a@b.com", subject="Hi", html="<p>x</p>", text="x"))
    msg = captured["message"]
    assert captured["conn"] == ("smtp.example.com", 587) and captured["tls"] and captured["login"] == ("mailer", "pw")
    assert msg["To"] == "a@b.com" and msg["Subject"] == "Hi" and msg.is_multipart()
    assert {part.get_content_type() for part in msg.iter_parts()} == {"text/plain", "text/html"}


# ---------------------------------------------------------------- integrations

@pytest.fixture()
def posts(monkeypatch):
    """Stand-in for the network: DNS resolves to a public address and POSTs are recorded."""
    calls = []
    monkeypatch.setattr(integration_service, "resolve_host", lambda host: ["93.184.216.34"])
    monkeypatch.setattr(integration_service, "_post", lambda url, body, headers, timeout=8.0: calls.append((url, json.loads(body), headers)) or 200)
    return calls


def test_a_webhook_receives_a_signed_payload_when_a_meeting_is_created(anon_client, posts):
    import hashlib, hmac
    headers = signup(anon_client)
    created = anon_client.post("/api/integrations", headers=headers, json={"kind": "webhook", "name": "Zapier", "url": "https://hooks.example.com/abc"})
    assert created.status_code == 201
    secret = created.json()["secret"]
    assert secret and created.json()["url_host"] == "hooks.example.com"
    assert "abc" not in json.dumps(created.json())  # the URL itself is never echoed back

    meeting = add_meeting(anon_client, headers, "Launch review")
    assert len(posts) == 1
    url, payload, sent_headers = posts[0]
    assert url == "https://hooks.example.com/abc" and payload["event"] == "meeting.completed"
    assert payload["meeting"]["title"] == "Launch review" and payload["meeting"]["url"].endswith(f"/meetings/{meeting['id']}")
    body = json.dumps(payload).encode()
    # the signature covers the exact bytes sent; recompute over the same serialisation
    assert sent_headers["X-Signature"].startswith("sha256=") and sent_headers["X-Event"] == "meeting.completed"
    assert hmac.compare_digest(sent_headers["X-Signature"], "sha256=" + hmac.new(secret.encode(), integration_service.build_payload(
        integration_service.Integration(kind="webhook", config={"secret": secret}), title="Launch review", url=payload["meeting"]["url"],
        overview=payload["meeting"]["overview"], action_items=payload["meeting"]["action_items"])[0], hashlib.sha256).hexdigest())
    assert body
    listed = anon_client.get("/api/integrations", headers=headers).json()
    assert listed[0]["last_status"] == "ok" and listed[0]["last_run_at"]


def test_slack_gets_a_message_in_slacks_format(anon_client, posts):
    headers = signup(anon_client)
    ok = anon_client.post("/api/integrations", headers=headers, json={"kind": "slack", "name": "#team", "url": "https://hooks.slack.com/services/T/B/x"})
    assert ok.status_code == 201 and ok.json()["secret"] is None
    add_meeting(anon_client, headers, "Retro")
    text = posts[0][1]["text"]
    assert "Retro" in text and "is ready" in text and "Action items" in text


def test_slack_integrations_must_use_slacks_host(anon_client, posts):
    headers = signup(anon_client)
    res = anon_client.post("/api/integrations", headers=headers, json={"kind": "slack", "name": "x", "url": "https://evil.example.com/hook"})
    assert (res.status_code, res.json()["code"]) == (422, "invalid_webhook_url")


@pytest.mark.parametrize(
    "url, resolves_to",
    [
        ("http://hooks.example.com/x", "93.184.216.34"),          # not https
        ("https://user:pw@hooks.example.com/x", "93.184.216.34"),  # credentials in the URL
        ("https://localhost/x", "127.0.0.1"),
        ("https://internal.example.com/x", "10.0.0.5"),
        ("https://metadata.example.com/x", "169.254.169.254"),     # cloud metadata endpoint
        ("https://v6.example.com/x", "::1"),
        ("not a url", "93.184.216.34"),
    ],
)
def test_webhook_urls_cannot_target_private_networks(anon_client, monkeypatch, url, resolves_to):
    monkeypatch.setattr(integration_service, "resolve_host", lambda host: [resolves_to])
    headers = signup(anon_client)
    res = anon_client.post("/api/integrations", headers=headers, json={"kind": "webhook", "name": "bad", "url": url})
    assert res.status_code == 422 and res.json()["code"] == "invalid_webhook_url"


def test_a_host_that_later_resolves_to_a_private_address_is_blocked_at_send_time(anon_client, monkeypatch, posts):
    headers = signup(anon_client)
    anon_client.post("/api/integrations", headers=headers, json={"kind": "webhook", "name": "w", "url": "https://hooks.example.com/x"})
    monkeypatch.setattr(integration_service, "resolve_host", lambda host: ["10.1.2.3"])  # DNS changed
    add_meeting(anon_client, headers)
    assert posts == []
    assert "private network" in anon_client.get("/api/integrations", headers=headers).json()[0]["last_status"]


def test_integration_management(anon_client, posts):
    headers = signup(anon_client)
    wid = anon_client.post("/api/integrations", headers=headers, json={"kind": "webhook", "name": "w", "url": "https://hooks.example.com/x"}).json()["id"]
    test = anon_client.post(f"/api/integrations/{wid}/test", headers=headers)
    assert test.json() == {"result": "ok"} and posts[-1][1]["test"] is True
    anon_client.patch(f"/api/integrations/{wid}", headers=headers, json={"enabled": False, "name": "renamed"})
    before = len(posts)
    add_meeting(anon_client, headers)
    assert len(posts) == before  # disabled integrations receive nothing
    assert anon_client.get("/api/integrations", headers=headers).json()[0]["name"] == "renamed"
    assert anon_client.delete(f"/api/integrations/{wid}", headers=headers).status_code == 204
    assert anon_client.post(f"/api/integrations/{wid}/test", headers=headers).status_code == 404


def test_delivery_failures_are_recorded_not_raised(anon_client, monkeypatch):
    monkeypatch.setattr(integration_service, "resolve_host", lambda host: ["93.184.216.34"])
    monkeypatch.setattr(integration_service, "_post", lambda *a, **k: 500)
    headers = signup(anon_client)
    anon_client.post("/api/integrations", headers=headers, json={"kind": "webhook", "name": "w", "url": "https://hooks.example.com/x"})
    assert add_meeting(anon_client, headers)["status"] == "ready"
    assert anon_client.get("/api/integrations", headers=headers).json()[0]["last_status"] == "HTTP 500"


def test_integrations_are_private_and_capped(anon_client, posts):
    a, b = signup(anon_client, "a@example.com"), signup(anon_client, "b@example.com", name="B")
    wid = anon_client.post("/api/integrations", headers=a, json={"kind": "webhook", "name": "w", "url": "https://hooks.example.com/x"}).json()["id"]
    assert anon_client.get("/api/integrations", headers=b).json() == []
    assert anon_client.delete(f"/api/integrations/{wid}", headers=b).status_code == 404
    for i in range(9):
        anon_client.post("/api/integrations", headers=a, json={"kind": "webhook", "name": f"w{i}", "url": f"https://hooks.example.com/{i}"})
    assert anon_client.post("/api/integrations", headers=a, json={"kind": "webhook", "name": "x", "url": "https://hooks.example.com/z"}).json()["code"] == "too_many_integrations"


def test_redirects_are_never_followed():
    import urllib.request
    assert integration_service._NoRedirect().redirect_request(urllib.request.Request("https://a.example"), None, 302, "Found", {}, "http://127.0.0.1/") is None


# ---------------------------------------------------------------- compliance notice

def test_other_participants_get_the_compliance_notice_but_the_owner_does_not(anon_client):
    headers = signup(anon_client)
    anon_client.patch("/api/settings", headers=headers, json={"email": {"recap_recipients": "participants"}, "compliance": {"announcement": "Recorded for note-taking."}})
    transcript = json.dumps([{"speaker": "Alice", "text": "hello there everyone"}, {"speaker": "Bob", "text": "hi"}])
    first = add_meeting(anon_client, headers, "One", transcript_text=transcript)
    alice = next(p for p in first["participants"] if p["name"] == "Alice")
    anon_client.patch(f"/api/meetings/{first['id']}", headers=headers, json={"participants": [{"id": alice["id"], "name": "Alice", "email": "alice@example.com"}]})
    second = add_meeting(anon_client, headers, "Two", transcript_text=transcript)
    by_to = {e["to_email"]: detail(anon_client, headers, e["id"])["text"] for e in emails(anon_client, headers) if e["meeting_id"] == second["id"]}
    assert "Recorded for note-taking." in by_to["alice@example.com"]
    assert "Recorded for note-taking." not in by_to["ada@example.com"]


def test_the_compliance_notice_can_be_switched_off(anon_client):
    headers = signup(anon_client)
    anon_client.patch("/api/settings", headers=headers, json={"email": {"recap_recipients": "participants"}, "compliance": {"notify_participants": False}})
    transcript = json.dumps([{"speaker": "Alice", "text": "hello there everyone"}])
    first = add_meeting(anon_client, headers, "One", transcript_text=transcript)
    anon_client.patch(f"/api/meetings/{first['id']}", headers=headers, json={"participants": [{"id": first["participants"][0]["id"], "name": "Alice", "email": "alice@example.com"}]})
    second = add_meeting(anon_client, headers, "Two", transcript_text=transcript)
    mail = next(e for e in emails(anon_client, headers) if e["meeting_id"] == second["id"] and e["to_email"] == "alice@example.com")
    assert "recorded and transcribed" not in detail(anon_client, headers, mail["id"])["text"]


def test_real_email_is_sent_for_normal_accounts_but_never_for_the_demo_account(anon_client, monkeypatch):
    sent = []
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.test")
    monkeypatch.setattr(email_service.SmtpTransport, "send", lambda self, msg: sent.append((msg.to, msg.subject)))
    recaps = lambda: [x for x in sent if x[1].startswith("Your meeting recap")]

    ada = signup(anon_client)
    add_meeting(anon_client, ada, "Real account")
    assert recaps() == [("ada@example.com", "Your meeting recap - Real account")]

    token = anon_client.post("/api/auth/demo").json()["token"]
    demo = {"Authorization": f"Bearer {token}"}
    add_meeting(anon_client, demo, "Demo upload")
    assert len(recaps()) == 1  # nothing went out for the demo account
    recap = [e for e in emails(anon_client, demo) if e["subject"] == "Your meeting recap - Demo upload"]
    assert len(recap) == 1 and recap[0]["transport"] == "log"  # but it is still visible in the outbox


def test_the_recap_shows_counts_keywords_and_overview_bullets(anon_client):
    headers = signup(anon_client)
    text = "\n".join([
        "[00:00:01] Maya: Are we shipping on Friday?",
        "[00:00:08] Leo: Yes, the build goes out Friday at 5 pm.",
        "[00:00:15] Maya: Can you email the testers by tomorrow? Also, who owns the checklist?",
    ])
    meeting = anon_client.post("/api/meetings", headers=headers, json={"title": "Ship check", "transcript_text": text}).json()
    recap = next(e for e in emails(anon_client, headers) if e["meeting_id"] == meeting["id"] and e["subject"].startswith("Your meeting recap"))
    html, plain = detail(anon_client, headers, recap["id"])["html"], detail(anon_client, headers, recap["id"])["text"]
    assert "In this meeting" in html and "Questions were asked" in html and "Dates &amp; times discussed" in html
    assert "DISCUSSED IN THIS MEETING" in html and "Meeting Overview" in html and "View complete meeting notes" in html
    assert "IN THIS MEETING" in plain and "2 questions asked" in plain
