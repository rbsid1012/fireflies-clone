import pytest
from sqlalchemy import func, select, text

from app.models import (
    ActionItem, Chapter, Meeting, MeetingParticipant, MeetingStatus, Person, Soundbite,
    Summary, Tag, TranscriptSegment, User,
)
from app.seed.loader import DATA_DIR, SeedMeeting, load_seed_meetings
from app.seed.seed import reset_database, seed_if_empty


def count(db, model) -> int:
    return db.scalar(select(func.count()).select_from(model))


def test_all_seed_files_load_and_are_in_expected_range():
    meetings = load_seed_meetings()
    assert 6 <= len(meetings) <= 8
    assert all(2 <= len(m.participants) <= 5 for m in meetings)
    sizes = [len(m.segments) for m in meetings]
    assert max(sizes) >= 2 * min(sizes)  # varied lengths


def test_loader_rejects_unknown_speaker():
    bad = {
        "title": "x", "started_at": "2026-01-01T00:00:00+00:00",
        "participants": [{"label": "A", "name": "A", "email": "a@x.com"}],
        "segments": [["Nobody", "hi"]], "overview": "o", "keywords": [], "chapters": [],
        "action_items": [],
    }
    with pytest.raises(ValueError, match="not a participant"):
        SeedMeeting.model_validate(bad)


def test_loader_rejects_out_of_range_index():
    bad = {
        "title": "x", "started_at": "2026-01-01T00:00:00+00:00",
        "participants": [{"label": "A", "name": "A", "email": "a@x.com"}],
        "segments": [["A", "hi"]], "overview": "o", "keywords": [], "chapters": [],
        "action_items": [{"at": 5, "text": "t"}],
    }
    with pytest.raises(ValueError, match="out of range"):
        SeedMeeting.model_validate(bad)


def test_seed_populates_an_empty_database(db):
    assert seed_if_empty(db) is True
    n_files = len(list(DATA_DIR.glob("*.json")))
    assert count(db, Meeting) == n_files
    assert count(db, Summary) == n_files
    assert count(db, User) == 1
    assert count(db, Chapter) > n_files
    assert count(db, ActionItem) > n_files
    assert count(db, Soundbite) >= 1
    assert count(db, Tag) >= 5
    meetings = db.scalars(select(Meeting)).all()
    assert all(m.status == MeetingStatus.ready and m.media_url is None for m in meetings)


def test_seed_is_idempotent(db):
    seed_if_empty(db)
    before = {m: count(db, m) for m in (Meeting, TranscriptSegment, Person, Tag, ActionItem)}
    assert seed_if_empty(db) is False
    assert {m: count(db, m) for m in before} == before


def test_seed_does_not_resurrect_after_user_deletes_meetings(db):
    seed_if_empty(db)
    db.execute(text("DELETE FROM meetings"))
    db.commit()
    assert seed_if_empty(db) is False
    assert count(db, Meeting) == 0


def test_reset_then_reseed_restores_same_data(db):
    seed_if_empty(db)
    before = count(db, TranscriptSegment)
    reset_database(db)
    assert count(db, Meeting) == 0 and count(db, Person) == 0
    assert seed_if_empty(db) is True
    assert count(db, TranscriptSegment) == before


def test_transcripts_are_ordered_integer_ms_and_inside_duration(db):
    seed_if_empty(db)
    for meeting in db.scalars(select(Meeting)):
        segs = db.scalars(
            select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting.id)
            .order_by(TranscriptSegment.seq)
        ).all()
        assert [s.seq for s in segs] == list(range(len(segs)))
        for a, b in zip(segs, segs[1:]):
            assert a.start_ms < a.end_ms <= b.start_ms
        assert meeting.duration_ms > segs[-1].end_ms
        assert all(isinstance(s.start_ms, int) and isinstance(s.end_ms, int) for s in segs)


def test_people_are_shared_across_meetings(db):
    seed_if_empty(db)
    alex = db.scalar(select(Person).where(Person.email == "alex.morgan@lumenly.io"))
    appearances = count_participations(db, alex.id)
    assert appearances >= 5
    assert db.scalar(select(func.count()).select_from(Person).where(Person.email == alex.email)) == 1
    assert count(db, Person) < count(db, MeetingParticipant)  # fewer people than participations


def count_participations(db, person_id: int) -> int:
    return db.scalar(
        select(func.count()).select_from(MeetingParticipant).where(MeetingParticipant.person_id == person_id)
    )


def test_references_stay_within_their_meeting(db):
    seed_if_empty(db)
    items = db.scalars(select(ActionItem)).all()
    for item in items:
        seg = db.get(TranscriptSegment, item.source_segment_id)
        assert seg.meeting_id == item.meeting_id
        if item.assignee_participant_id:
            assert db.get(MeetingParticipant, item.assignee_participant_id).meeting_id == item.meeting_id
    for ch in db.scalars(select(Chapter)):
        starts = {s.start_ms for s in db.scalars(
            select(TranscriptSegment).where(TranscriptSegment.meeting_id == ch.meeting_id))}
        assert ch.start_ms in starts


def test_completed_items_have_completion_time(db):
    seed_if_empty(db)
    for item in db.scalars(select(ActionItem)):
        assert (item.completed_at is not None) == item.is_completed


def test_seeded_transcripts_are_searchable_through_fts(db):
    seed_if_empty(db)
    rows = db.execute(text(
        "SELECT DISTINCT meeting_id FROM transcript_fts WHERE transcript_fts MATCH 'kafka'"
    )).all()
    assert len(rows) == 1
    title = db.get(Meeting, rows[0][0]).title
    assert "Interview" in title
    assert db.execute(text("SELECT count(*) FROM transcript_fts WHERE transcript_fts MATCH 'carrier'")).scalar() > 5
