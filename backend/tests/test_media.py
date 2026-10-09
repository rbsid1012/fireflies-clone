import io

from app.config import settings
from tests.helpers import TRANSCRIPT, add_meeting, signup

AUDIO = b"ID3" + bytes(range(256)) * 40  # 10 KB of fake audio


def upload(client, headers, meeting_id, data=AUDIO, name="talk.mp3", ctype="audio/mpeg"):
    return client.post(f"/api/meetings/{meeting_id}/media", headers=headers, files={"file": (name, io.BytesIO(data), ctype)})


def test_media_can_be_attached_streamed_and_replaced(anon_client, tmp_path):
    headers = signup(anon_client)
    meeting = add_meeting(anon_client, headers)
    assert meeting["media_url"] is None

    res = upload(anon_client, headers, meeting["id"])
    assert res.status_code == 201
    url = res.json()["media_url"]
    assert url.startswith(f"/api/media/{meeting['id']}?sig=") and "&v=" in url

    streamed = anon_client.get(url)  # no Authorization header: the signature is the credential
    assert streamed.status_code == 200 and streamed.content == AUDIO and streamed.headers["content-type"] == "audio/mpeg"
    assert anon_client.get(url, headers={"Range": "bytes=0-9"}).status_code == 206  # seeking works

    assert anon_client.get(f"/api/media/{meeting['id']}?sig=forged").status_code == 404
    assert anon_client.get(f"/api/media/{meeting['id'] + 1}?" + url.split("?")[1]).status_code == 404  # sig is per meeting

    replaced = upload(anon_client, headers, meeting["id"], b"ID3" + b"x" * 500, "other.mp3")
    assert replaced.status_code == 201 and anon_client.get(replaced.json()["media_url"]).content.startswith(b"ID3x")
    assert replaced.json()["media_url"] != url  # new version marker busts the browser cache
    assert len([p for p in (tmp_path / "media").rglob("*.mp3")]) == 1  # the old file was deleted


def test_media_can_be_supplied_when_the_meeting_is_created(anon_client):
    headers = signup(anon_client)
    res = anon_client.post(
        "/api/meetings", headers=headers, data={"transcript_text": TRANSCRIPT, "title": "With audio"},
        files={"media": ("call.mp4", io.BytesIO(AUDIO), "video/mp4")},
    )
    assert res.status_code == 201 and res.json()["media_url"]
    assert anon_client.get(res.json()["media_url"]).headers["content-type"] == "video/mp4"


def test_a_bad_media_file_stops_the_meeting_from_being_created(anon_client):
    headers = signup(anon_client)
    res = anon_client.post(
        "/api/meetings", headers=headers, data={"transcript_text": TRANSCRIPT},
        files={"media": ("virus.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
    )
    assert res.status_code == 422 and res.json()["code"] == "invalid_media"
    assert [m["title"] for m in anon_client.get("/api/meetings", headers=headers).json()["items"]] == ["Sample: Engineering Daily Standup"]


def test_media_validation(anon_client, monkeypatch):
    headers = signup(anon_client)
    meeting = add_meeting(anon_client, headers)
    assert upload(anon_client, headers, meeting["id"], name="notes.txt", ctype="text/plain").json()["code"] == "invalid_media"
    assert upload(anon_client, headers, meeting["id"], name="song.mp3", ctype="text/html").json()["code"] == "invalid_media"
    assert upload(anon_client, headers, meeting["id"], data=b"").json()["code"] == "invalid_media"
    monkeypatch.setattr(settings, "max_media_mb", 0)
    too_big = upload(anon_client, headers, meeting["id"])
    assert (too_big.status_code, too_big.json()["code"]) == (413, "media_too_large")
    assert anon_client.get(f"/api/meetings/{meeting['id']}", headers=headers).json()["media_url"] is None  # nothing half-saved


def test_media_belongs_to_its_owner(anon_client):
    a, b = signup(anon_client, "a@example.com"), signup(anon_client, "b@example.com", name="B")
    meeting = add_meeting(anon_client, a)
    assert upload(anon_client, b, meeting["id"]).status_code == 404
    assert anon_client.delete(f"/api/meetings/{meeting['id']}/media", headers=b).status_code == 404


def test_filenames_cannot_escape_the_media_directory(anon_client, tmp_path):
    headers = signup(anon_client)
    meeting = add_meeting(anon_client, headers)
    assert upload(anon_client, headers, meeting["id"], name="../../evil.mp3").status_code == 201
    media_root = tmp_path / "media"
    assert not list(tmp_path.glob("evil*")) and any(media_root.rglob("*.mp3"))  # stored inside, under a generated name
    assert "evil" not in str([p.name for p in media_root.rglob("*")])


def test_files_are_removed_with_the_media_the_meeting_or_the_account(anon_client, tmp_path):
    headers = signup(anon_client)
    files = lambda: [p for p in (tmp_path / "media").rglob("*.mp3")]
    m1, m2 = add_meeting(anon_client, headers, "one"), add_meeting(anon_client, headers, "two")
    upload(anon_client, headers, m1["id"]); upload(anon_client, headers, m2["id"])
    assert len(files()) == 2
    assert anon_client.delete(f"/api/meetings/{m1['id']}/media", headers=headers).json()["media_url"] is None and len(files()) == 1
    upload(anon_client, headers, m1["id"])
    anon_client.delete(f"/api/meetings/{m1['id']}", headers=headers)
    assert len(files()) == 1
    anon_client.request("DELETE", "/api/me", headers=headers, json={"password": "correct-horse-battery"})
    assert files() == []


def test_untyped_uploads_get_a_content_type_from_their_extension(anon_client):
    headers = signup(anon_client)
    meeting = add_meeting(anon_client, headers)
    res = upload(anon_client, headers, meeting["id"], name="call.flac", ctype="application/octet-stream")
    assert res.status_code == 201
    assert anon_client.get(res.json()["media_url"]).headers["content-type"] == "audio/flac"


def test_every_common_recording_format_can_be_attached(anon_client):
    headers = signup(anon_client)
    for ext in ("mp3", "m4a", "aac", "ogg", "opus", "flac", "wav", "wma", "mp4", "mov", "webm", "mkv", "avi", "3gp"):
        meeting = add_meeting(anon_client, headers, ext)
        assert upload(anon_client, headers, meeting["id"], name=f"call.{ext}", ctype="application/octet-stream").status_code == 201, ext
    assert upload(anon_client, headers, meeting["id"], name="call.exe", ctype="application/octet-stream").status_code == 422
