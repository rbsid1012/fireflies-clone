from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.errors import NotFoundError, ValidationFailed
from app.models import ActionItem, Meeting, MeetingParticipant, TranscriptSegment, User
from app.models.base import utcnow
from app.schemas.action_item import ActionItemCreate, ActionItemUpdate
from app.services.meeting_service import require_meeting

_LOAD = (
    selectinload(ActionItem.assignee).selectinload(MeetingParticipant.person),
    selectinload(ActionItem.source_segment),
)


def _check_refs(db: Session, meeting_id: int, assignee_id: int | None, segment_id: int | None) -> None:
    """Assignee and source segment must belong to the same meeting as the item."""
    if assignee_id is not None:
        part = db.get(MeetingParticipant, assignee_id)
        if part is None or part.meeting_id != meeting_id:
            raise ValidationFailed("assignee_participant_id is not a participant of this meeting.", "invalid_assignee")
    if segment_id is not None:
        seg = db.get(TranscriptSegment, segment_id)
        if seg is None or seg.meeting_id != meeting_id:
            raise ValidationFailed("source_segment_id is not a segment of this meeting.", "invalid_segment")


def get_action_item(db: Session, owner: User, item_id: int) -> ActionItem:
    item = db.scalar(
        select(ActionItem).join(Meeting, Meeting.id == ActionItem.meeting_id)
        .where(ActionItem.id == item_id, Meeting.owner_id == owner.id)
        .options(*_LOAD).execution_options(populate_existing=True)
    )
    if item is None:
        raise NotFoundError("Action item")
    return item


def create_action_item(db: Session, owner: User, meeting_id: int, data: ActionItemCreate) -> ActionItem:
    require_meeting(db, owner, meeting_id)
    _check_refs(db, meeting_id, data.assignee_participant_id, data.source_segment_id)
    item = ActionItem(
        meeting_id=meeting_id, text=data.text, assignee_participant_id=data.assignee_participant_id,
        due_date=data.due_date, source_segment_id=data.source_segment_id,
    )
    db.add(item)
    db.commit()
    return get_action_item(db, owner, item.id)


def update_action_item(db: Session, owner: User, item_id: int, data: ActionItemUpdate) -> ActionItem:
    item = get_action_item(db, owner, item_id)
    fields = data.model_fields_set
    if "text" in fields and data.text is not None:
        item.text = data.text
    if "assignee_participant_id" in fields:
        _check_refs(db, item.meeting_id, data.assignee_participant_id, None)
        item.assignee_participant_id = data.assignee_participant_id
    if "due_date" in fields:
        item.due_date = data.due_date
    if "is_completed" in fields and data.is_completed is not None and data.is_completed != item.is_completed:
        item.is_completed = data.is_completed
        item.completed_at = utcnow() if data.is_completed else None
    db.commit()
    return get_action_item(db, owner, item_id)


def delete_action_item(db: Session, owner: User, item_id: int) -> None:
    db.delete(get_action_item(db, owner, item_id))
    db.commit()
