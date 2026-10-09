from pydantic import BaseModel, ConfigDict, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORM):
    id: int
    name: str
    email: str
    avatar_url: str | None
    is_demo: bool = False
    has_password: bool = False


class PersonOut(ORM):
    id: int
    name: str
    email: str | None
    meeting_count: int = 0


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class TagRefOut(ORM):
    """A tag as it appears on a meeting: no count, which only makes sense in the tag list."""

    id: int
    name: str
    color: str


class TagOut(ORM):
    id: int
    name: str
    color: str
    meeting_count: int = 0


class ParticipantOut(ORM):
    """A person as they appear in one meeting. `id` is the participant id used by segments."""

    id: int
    person_id: int
    name: str
    email: str | None
    speaker_label: str
    color_index: int
