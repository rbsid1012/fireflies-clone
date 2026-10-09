from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import NotFoundError
from app.models import Meeting, MeetingParticipant, MeetingTag, Person, Tag, User

DEFAULT_USER = {"name": "Alex Morgan", "email": "alex.morgan@lumenly.io"}


def get_default_user(db: Session) -> User:
    """The demo account (used by the demo login and tests). Created on demand if missing."""
    user = db.scalar(select(User).where(User.is_demo.is_(True)).order_by(User.id).limit(1))
    if user is None:
        user = User(**DEFAULT_USER, is_demo=True)
        db.add(user)
        db.commit()
    return user


def list_people(db: Session, owner: User) -> list[Person]:
    """People who appear in the owner's meetings, with how many meetings each is in."""
    rows = db.execute(
        select(Person, func.count(func.distinct(MeetingParticipant.meeting_id)))
        .join(MeetingParticipant, MeetingParticipant.person_id == Person.id)
        .join(Meeting, Meeting.id == MeetingParticipant.meeting_id)
        .where(Meeting.owner_id == owner.id)
        .group_by(Person.id)
        .order_by(Person.name)
    ).all()
    for person, count in rows:
        person.meeting_count = count
    return [p for p, _ in rows]


def delete_tag(db: Session, owner: User, tag_id: int) -> None:
    """Remove a channel. Meetings keep everything else; only the label goes."""
    tag = db.scalar(select(Tag).where(Tag.id == tag_id, Tag.owner_id == owner.id))
    if tag is None:
        raise NotFoundError("Channel")
    db.execute(MeetingTag.__table__.delete().where(MeetingTag.tag_id == tag.id))
    db.delete(tag)
    db.commit()


def list_tags(db: Session, owner: User) -> list[Tag]:
    rows = db.execute(
        select(Tag, func.count(MeetingTag.meeting_id))
        .outerjoin(MeetingTag, MeetingTag.tag_id == Tag.id)
        .where(Tag.owner_id == owner.id)
        .group_by(Tag.id)
        .order_by(func.lower(Tag.name))
    ).all()
    for tag, count in rows:
        tag.meeting_count = count
    return [t for t, _ in rows]
