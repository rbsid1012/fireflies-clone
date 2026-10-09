from datetime import datetime, timezone

import pytest
from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import IntegrityError

from app.models import (
    ActionItem, Meeting, MeetingParticipant, MeetingSource, MeetingStatus, Person,
    Summary, SummarySource, TranscriptSegment, User,
)

NOW = datetime(2026, 1, 5, 10, 0, tzinfo=timezone.utc)


def make_meeting(db, title="Standup") -> Meeting:
    user = db.scalar(select(User)) or User(name="Me", email="me@example.com")
    db.add(user)
    db.flush()
    m = Meeting(
        owner_id=user.id, title=title, started_at=NOW, duration_ms=60_000,
        source=MeetingSource.seed, status=MeetingStatus.ready,
    )
    db.add(m)
    db.flush()
    return m


def add_participant(db, meeting, name="Alice", email=None) -> MeetingParticipant:
    person = Person(owner_id=meeting.owner_id, name=name, email=email)
    db.add(person)
    db.flush()
    p = MeetingParticipant(meeting_id=meeting.id, person_id=person.id, speaker_label=name)
    db.add(p)
    db.flush()
    return p


def add_segment(db, meeting, participant, seq, body) -> TranscriptSegment:
    s = TranscriptSegment(
        meeting_id=meeting.id, participant_id=participant.id, seq=seq,
        start_ms=seq * 1000, end_ms=seq * 1000 + 900, text=body,
    )
    db.add(s)
    db.flush()
    return s


def fts_hits(db, query: str) -> list[int]:
    rows = db.execute(
        text("SELECT rowid FROM transcript_fts WHERE transcript_fts MATCH :q ORDER BY rowid"),
        {"q": query},
    )
    return [r[0] for r in rows]


def test_tables_and_triggers_exist(db):
    names = {r[0] for r in db.execute(text("SELECT name FROM sqlite_master"))}
    assert {"meetings", "transcript_segments", "transcript_fts"} <= names
    assert {"transcript_segments_ai", "transcript_segments_ad", "transcript_segments_au"} <= names


def test_fts_insert_is_searchable_with_stemming(db):
    m = make_meeting(db)
    a = add_participant(db, m)
    seg = add_segment(db, m, a, 0, "We are deploying the new billing service on Friday")
    assert fts_hits(db, "deploy") == [seg.id]  # porter stemmer: deploying -> deploy
    assert fts_hits(db, "kubernetes") == []


def test_fts_update_replaces_old_text(db):
    m = make_meeting(db)
    a = add_participant(db, m)
    seg = add_segment(db, m, a, 0, "pricing discussion")
    seg.text = "roadmap discussion"
    db.flush()
    assert fts_hits(db, "pricing") == []
    assert fts_hits(db, "roadmap") == [seg.id]


def test_fts_delete_segment_removes_entry(db):
    m = make_meeting(db)
    a = add_participant(db, m)
    seg = add_segment(db, m, a, 0, "unique-token zebra")
    db.execute(delete(TranscriptSegment).where(TranscriptSegment.id == seg.id))
    assert fts_hits(db, "zebra") == []


def test_deleting_meeting_cascades_everywhere_including_fts(db):
    m = make_meeting(db)
    a = add_participant(db, m)
    seg = add_segment(db, m, a, 0, "cascade giraffe")
    db.add(ActionItem(meeting_id=m.id, text="x", source_segment_id=seg.id))
    db.add(Summary(meeting_id=m.id, overview="o", keywords=["k"], generated_by=SummarySource.seed))
    db.flush()

    db.execute(delete(Meeting).where(Meeting.id == m.id))

    for table in ("transcript_segments", "meeting_participants", "action_items", "summaries"):
        assert db.scalar(text(f"SELECT count(*) FROM {table}")) == 0, table
    assert fts_hits(db, "giraffe") == []  # triggers fire for cascaded deletes too
    assert db.scalar(select(func.count()).select_from(Person)) == 1  # people survive


def test_deleting_segment_nulls_action_item_source(db):
    m = make_meeting(db)
    a = add_participant(db, m)
    seg = add_segment(db, m, a, 0, "hello")
    item = ActionItem(meeting_id=m.id, text="follow up", source_segment_id=seg.id)
    db.add(item)
    db.flush()
    db.execute(delete(TranscriptSegment).where(TranscriptSegment.id == seg.id))
    db.refresh(item)
    assert item.source_segment_id is None


def test_segment_seq_unique_per_meeting(db):
    m = make_meeting(db)
    a = add_participant(db, m)
    add_segment(db, m, a, 0, "one")
    with pytest.raises(IntegrityError):
        add_segment(db, m, a, 0, "duplicate seq")


def test_participant_unique_per_meeting_and_person(db):
    m = make_meeting(db)
    a = add_participant(db, m)
    db.add(MeetingParticipant(meeting_id=m.id, person_id=a.person_id, speaker_label="dup"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_people_email_unique_per_account_but_multiple_nulls_allowed(db):
    owner = User(name="Me", email="me@example.com")
    other = User(name="Other", email="other@example.com")
    db.add_all([owner, other])
    db.flush()
    db.add_all([Person(owner_id=owner.id, name="A"), Person(owner_id=owner.id, name="B")])
    db.flush()  # two NULL emails in one account: fine
    db.add(Person(owner_id=owner.id, name="C", email="c@x.com"))
    db.add(Person(owner_id=other.id, name="C", email="c@x.com"))  # same email, different account: fine
    db.flush()
    db.add(Person(owner_id=owner.id, name="D", email="c@x.com"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_invalid_enum_value_rejected_by_check_constraint(db):
    m = make_meeting(db)
    db.commit()
    with pytest.raises(IntegrityError):
        db.execute(text("UPDATE meetings SET status='bogus' WHERE id=:i"), {"i": m.id})
