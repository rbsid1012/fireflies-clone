"""Migrations must never lose data. SQLite rebuilds tables for most ALTERs, and with foreign keys
enforced, rebuilding a parent table cascade-deletes its children, so these tests run migrations
over a database that already contains real rows."""
import sqlite3

import pytest

from app.db import downgrade_to, upgrade_to_head


def populate_pre_accounts_database(path: str) -> None:
    """Rows as the app wrote them at revision 0002 (before accounts existed)."""
    c = sqlite3.connect(path)
    c.execute("INSERT INTO users(id,name,email,created_at) VALUES (1,'Alex','alex@x.com','2026-01-01')")
    c.execute("INSERT INTO people(id,name,email,created_at) VALUES (1,'Ann','ann@x.com','2026-01-01'),(2,'Bo',NULL,'2026-01-01')")
    c.execute(
        "INSERT INTO meetings(id,owner_id,title,started_at,duration_ms,source,status,created_at,updated_at) "
        "VALUES (1,1,'Standup','2026-01-02 10:00:00',60000,'seed','ready','2026-01-01','2026-01-01')"
    )
    c.execute("INSERT INTO meeting_participants(id,meeting_id,person_id,speaker_label,color_index) VALUES (1,1,1,'Ann',0),(2,1,2,'Bo',1)")
    c.execute(
        "INSERT INTO transcript_segments(id,meeting_id,participant_id,seq,start_ms,end_ms,text) "
        "VALUES (1,1,1,0,0,2000,'we are deploying the kafka pipeline'),(2,1,2,1,2500,4000,'sounds good')"
    )
    c.execute("INSERT INTO summaries(id,meeting_id,overview,keywords,generated_by,generated_at) VALUES (1,1,'o','[]','seed','2026-01-01')")
    c.execute("INSERT INTO action_items(id,meeting_id,text,is_completed,created_at,updated_at) VALUES (1,1,'do it',0,'2026-01-01','2026-01-01')")
    c.execute("INSERT INTO tags(id,name,color) VALUES (1,'sales','green')")
    c.execute("INSERT INTO meeting_tags(meeting_id,tag_id) VALUES (1,1)")
    c.commit()
    c.close()


def counts(path: str) -> dict[str, int]:
    c = sqlite3.connect(path)
    tables = ["users", "people", "meetings", "meeting_participants", "transcript_segments",
              "summaries", "action_items", "tags", "meeting_tags"]
    out = {t: c.execute(f"SELECT count(*) FROM {t}").fetchone()[0] for t in tables}
    c.close()
    return out


@pytest.fixture()
def old_db(tmp_path):
    path = str(tmp_path / "old.db")
    url = f"sqlite:///{path}"
    upgrade_to_head(url, "0002")
    populate_pre_accounts_database(path)
    return path, url


def test_upgrade_over_existing_data_loses_nothing(old_db):
    path, url = old_db
    before = counts(path)
    upgrade_to_head(url)
    assert counts(path) == before
    c = sqlite3.connect(path)
    # existing people/tags are adopted by the first user, who becomes the (password-less) demo account
    assert {r[0] for r in c.execute("SELECT owner_id FROM people")} == {1}
    assert {r[0] for r in c.execute("SELECT owner_id FROM tags")} == {1}
    assert c.execute("SELECT is_demo, settings FROM users").fetchone() == (1, "{}")
    # full-text search and its triggers still work after tables were rebuilt
    hits = c.execute("SELECT rowid FROM transcript_fts WHERE transcript_fts MATCH 'kafka'").fetchall()
    assert hits == [(1,)]
    assert c.execute("PRAGMA foreign_key_check").fetchall() == []


def test_downgrade_and_upgrade_again_also_keep_data(old_db):
    path, url = old_db
    upgrade_to_head(url)
    before = counts(path)
    downgrade_to(url, "0002")
    assert counts(path) == before
    upgrade_to_head(url)
    assert counts(path) == before


def test_account_columns_and_constraints_are_enforced_after_upgrade(old_db):
    path, url = old_db
    upgrade_to_head(url)
    c = sqlite3.connect(path)
    c.execute("PRAGMA foreign_keys=ON")
    c.execute("INSERT INTO users(id,name,email,created_at,is_demo,settings) VALUES (2,'Zed','z@x.com','2026-01-01',0,'{}')")
    # the same person email may exist for two different accounts, but not twice for one
    c.execute("INSERT INTO people(name,email,owner_id,created_at) VALUES ('Ann','ann@x.com',2,'2026-01-01')")
    with pytest.raises(sqlite3.IntegrityError):
        c.execute("INSERT INTO people(name,email,owner_id,created_at) VALUES ('Ann2','ann@x.com',1,'2026-01-01')")
    # deleting an account removes its people (and meetings) but nothing of anyone else's
    c.execute("DELETE FROM users WHERE id = 2")
    assert c.execute("SELECT count(*) FROM people WHERE owner_id = 1").fetchone()[0] == 2
