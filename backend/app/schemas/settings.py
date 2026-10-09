"""Per-user preferences, one model per section of the Settings screens.

Every field here changes real behaviour, with one labelled exception: the `team` section holds
workspace defaults for when teammates can be invited. Teams are not part of this version, so those
values are saved and shown but not enforced on anyone (the UI says so).
"""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Theme = Literal["dark", "light", "system"]

# Languages offered for AI-written summaries and answers (code -> name used in the prompt)
LANGUAGES = {
    "en": "English", "es": "Spanish", "fr": "French", "de": "German", "pt": "Portuguese",
    "it": "Italian", "nl": "Dutch", "hi": "Hindi", "ja": "Japanese", "zh": "Chinese",
}


class Section(BaseModel):
    # Unknown keys in *stored* data are ignored (so removing a setting later can't wipe the rest);
    # unknown keys in an *update* are rejected by settings_service.
    model_config = ConfigDict(extra="ignore")


class AppearanceSettings(Section):
    theme: Theme = "dark"


class RecordingSettings(Section):
    # The language AI summaries and answers are written in
    meeting_language: Literal["en", "es", "fr", "de", "pt", "it", "nl", "hi", "ja", "zh"] = "en"
    # Delete meetings older than this many days. None = keep forever.
    auto_delete_days: int | None = Field(default=None, ge=1, le=3650)


class ComplianceSettings(Section):
    # Added to recap emails that go to other participants
    notify_participants: bool = True
    announcement: str = Field(default="This meeting was recorded and transcribed.", max_length=300)


class EmailSettings(Section):
    recap_recipients: Literal["me", "participants", "none"] = "me"
    recap_include: Literal["overview", "overview_actions", "full"] = "overview"


class AISettings(Section):
    summary_style: Literal["concise", "balanced", "detailed"] = "balanced"
    custom_instructions: str = Field(default="", max_length=1000)
    extract_action_items: bool = True


class KnowledgeBaseSettings(Section):
    # Background context given to Ask Fred ("our product is X, our customers are Y")
    notes: str = Field(default="", max_length=20_000)


TeamPolicy = Literal["choose", "on", "off"]


class TeamSettings(Section):
    """Workspace-wide defaults: "choose" lets each teammate decide, "on"/"off" would force it for everyone."""

    auto_record: TeamPolicy = "choose"
    capture_video: TeamPolicy = "choose"
    meeting_language: TeamPolicy = "choose"
    auto_delete: TeamPolicy = "choose"
    meeting_privacy: TeamPolicy = "choose"
    public_access: TeamPolicy = "choose"
    recap_email: TeamPolicy = "choose"
    record_rules: TeamPolicy = "choose"
    notify_email: TeamPolicy = "choose"
    chat_notification: TeamPolicy = "choose"
    ai_skills_create: TeamPolicy = "choose"
    ai_skills_access: TeamPolicy = "choose"
    personal_assistant: TeamPolicy = "on"
    realtime_pane: TeamPolicy = "choose"
    key_takeaways: TeamPolicy = "choose"
    talk_to_fred: TeamPolicy = "choose"


class UserSettings(Section):
    appearance: AppearanceSettings = AppearanceSettings()
    recording: RecordingSettings = RecordingSettings()
    compliance: ComplianceSettings = ComplianceSettings()
    email: EmailSettings = EmailSettings()
    ai: AISettings = AISettings()
    knowledge_base: KnowledgeBaseSettings = KnowledgeBaseSettings()
    team: TeamSettings = TeamSettings()


class UserSettingsPatch(BaseModel):
    """PATCH body: any subset of sections, each any subset of its own fields."""

    model_config = ConfigDict(extra="forbid")

    appearance: dict | None = None
    recording: dict | None = None
    compliance: dict | None = None
    email: dict | None = None
    ai: dict | None = None
    knowledge_base: dict | None = None
    team: dict | None = None
