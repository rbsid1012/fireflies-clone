from fastapi.testclient import TestClient

PASSWORD = "correct-horse-battery"
TRANSCRIPT = "[00:00:05] Alice: We need to ship the report by Friday.\n[00:00:14] Bob: I'll send the draft tomorrow."


def signup(client: TestClient, email: str = "ada@example.com", name: str = "Ada Lovelace", password: str = PASSWORD) -> dict:
    """Create an account and return Authorization headers for it."""
    res = client.post("/api/auth/signup", json={"name": name, "email": email, "password": password})
    assert res.status_code == 201, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


def add_meeting(client: TestClient, headers: dict, title: str = "Weekly sync", **extra) -> dict:
    res = client.post("/api/meetings", headers=headers, json={"title": title, "transcript_text": TRANSCRIPT, **extra})
    assert res.status_code == 201, res.text
    return res.json()
