"""Idempotent database seeding.

    python -m app.seed.seed            # seed only if the database is empty
    python -m app.seed.seed --reset    # wipe everything and reseed
"""
import argparse

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import (
    ActionItem, Chapter, Meeting, MeetingParticipant, MeetingSource, MeetingStatus,
    MeetingTag, Person, Soundbite, Summary, SummarySource, Tag, TranscriptSegment, User,
)
from app.seed.loader import SeedMeeting, load_seed_meetings
from app.services.timing import estimate_duration_ms, estimate_timings

DEFAULT_USER = {"name": "Alex Morgan", "email": "alex.morgan@lumenly.io", "is_demo": True}
TAG_COLORS = {
    "standup": "blue", "engineering": "indigo", "sales": "green", "sample": "gray", "customer": "teal",
    "hiring": "purple", "interview": "violet", "product": "orange", "review": "amber",
    "1:1": "pink", "incident": "red", "marketing": "rose", "planning": "cyan",
}


class _Registry:
    """Dedupes people and tags across meetings within one seeding run."""

    def __init__(self, db: Session, owner: User):
        self.db = db
        self.owner = owner
        self.people: dict[str, Person] = {}
        self.tags: dict[str, Tag] = {}

    def person(self, name: str, email: str) -> Person:
        if email not in self.people:
            p = Person(owner_id=self.owner.id, name=name, email=email)
            self.db.add(p)
            self.db.flush()
            self.people[email] = p
        return self.people[email]

    def tag(self, name: str) -> Tag:
        if name not in self.tags:
            t = Tag(owner_id=self.owner.id, name=name, color=TAG_COLORS.get(name, "gray"))
            self.db.add(t)
            self.db.flush()
            self.tags[name] = t
        return self.tags[name]


def _insert_meeting(db: Session, reg: _Registry, owner: User, data: SeedMeeting) -> Meeting:
    timings = estimate_timings([text for _, text in data.segments])
    meeting = Meeting(
        owner_id=owner.id, title=data.title, started_at=data.started_at,
        duration_ms=estimate_duration_ms(timings), source=MeetingSource.seed,
        media_url=None, status=MeetingStatus.ready,
    )
    db.add(meeting)
    db.flush()

    by_label: dict[str, MeetingParticipant] = {}
    for color, sp in enumerate(data.participants):
        person = reg.person(sp.name, sp.email)
        part = MeetingParticipant(
            meeting_id=meeting.id, person_id=person.id, speaker_label=sp.label, color_index=color
        )
        db.add(part)
        by_label[sp.label] = part
    db.flush()

    segments = [
        TranscriptSegment(
            meeting_id=meeting.id, participant_id=by_label[speaker].id, seq=seq,
            start_ms=start, end_ms=end, text=text,
        )
        for seq, ((speaker, text), (start, end)) in enumerate(zip(data.segments, timings))
    ]
    db.add_all(segments)
    db.flush()

    db.add(Summary(
        meeting_id=meeting.id, overview=data.overview, keywords=data.keywords,
        generated_by=SummarySource.seed,
    ))
    for seq, ch in enumerate(data.chapters):
        db.add(Chapter(
            meeting_id=meeting.id, seq=seq, title=ch.title,
            start_ms=segments[ch.at].start_ms, summary=ch.summary,
        ))
    for item in data.action_items:
        db.add(ActionItem(
            meeting_id=meeting.id, text=item.text,
            assignee_participant_id=by_label[item.assignee].id if item.assignee else None,
            source_segment_id=segments[item.at].id, due_date=item.due, is_completed=item.done,
            completed_at=data.started_at if item.done else None,
        ))
    for sb in data.soundbites:
        db.add(Soundbite(
            meeting_id=meeting.id, start_segment_id=segments[sb.from_seq].id,
            end_segment_id=segments[sb.to_seq].id, note=sb.note,
        ))
    for name in data.tags:
        db.add(MeetingTag(meeting_id=meeting.id, tag_id=reg.tag(name).id))
    db.flush()
    return meeting


def seed_database(db: Session) -> int:
    """Insert the default user and every seed meeting. Returns the number of meetings."""
    meetings = load_seed_meetings()
    owner = User(**DEFAULT_USER)
    db.add(owner)
    db.flush()
    reg = _Registry(db, owner)
    # The owner is also a person who speaks in meetings; share one row via email.
    reg.people[owner.email] = Person(owner_id=owner.id, name=owner.name, email=owner.email)
    db.add(reg.people[owner.email])
    db.flush()
    for data in meetings:
        _insert_meeting(db, reg, owner, data)
    db.commit()
    return len(meetings)




def add_sample_meeting(db: Session, owner: User) -> Meeting:
    """A short example meeting so a brand-new account has something to look at."""
    data = next(m for m in load_seed_meetings() if m.title == "Engineering Daily Standup")
    data = data.model_copy(update={"title": "Sample: Engineering Daily Standup", "tags": ["sample"]})
    reg = _Registry(db, owner)
    meeting = _insert_meeting(db, reg, owner, data)
    db.commit()
    return meeting


def seed_if_empty(db: Session) -> bool:
    """Seed only when there is no user yet. Deleting meetings later never triggers a reseed."""
    if db.scalar(select(func.count()).select_from(User)):
        return False
    seed_database(db)
    return True


def reset_database(db: Session) -> None:
    # Order matters: meetings (via user cascade) must go before people, which participants reference.
    db.execute(delete(User))  # cascades to meetings, people, tags, keys, integrations, email log
    db.commit()


def main() -> None:
    from app.db import SessionLocal, upgrade_to_head

    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="wipe all data first")
    args = parser.parse_args()

    upgrade_to_head()
    with SessionLocal() as db:
        if args.reset:
            reset_database(db)
        print("Seeded." if seed_if_empty(db) else "Database not empty; nothing to do (use --reset).")


if __name__ == "__main__":
    main()
