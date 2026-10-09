from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.models import User
from app.errors import ValidationFailed
from app.schemas.settings import (
    AISettings, AppearanceSettings, ComplianceSettings, EmailSettings, KnowledgeBaseSettings,
    RecordingSettings, TeamSettings, UserSettings, UserSettingsPatch,
)

SECTION_MODELS = {
    "appearance": AppearanceSettings, "recording": RecordingSettings, "compliance": ComplianceSettings,
    "email": EmailSettings, "ai": AISettings, "knowledge_base": KnowledgeBaseSettings, "team": TeamSettings,
}


def get_settings(user: User) -> UserSettings:
    """Stored preferences with defaults filled in. A corrupt stored value falls back to defaults."""
    try:
        return UserSettings.model_validate(user.settings or {})
    except ValidationError:
        return UserSettings()


def update_settings(db: Session, user: User, patch: UserSettingsPatch) -> UserSettings:
    """Merge a partial update section by section; each merged section is validated as a whole."""
    current = get_settings(user).model_dump()
    for section, values in patch.model_dump(exclude_none=True).items():
        model = SECTION_MODELS[section]
        unknown = sorted(set(values) - set(model.model_fields))
        if unknown:
            raise ValidationFailed(f"{section}.{unknown[0]}: Unknown setting")
        current[section] = model.model_validate({**current[section], **values}).model_dump()
    user.settings = current
    db.commit()
    return UserSettings.model_validate(current)
