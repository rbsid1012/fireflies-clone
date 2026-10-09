from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # On Railway this points at the mounted volume, e.g. /data/app.db
    db_path: str = str(BACKEND_DIR / "data" / "app.db")
    # Comma-separated list of allowed browser origins
    cors_origins: str = "http://localhost:3000"
    # Seed demo meetings on startup when the database has no users
    seed_on_startup: bool = True
    # "development" or "production". Production refuses to start with the default SECRET_KEY.
    app_env: str = "development"
    # Signs login tokens and media links. Set a long random value in production.
    secret_key: str = "dev-only-secret-change-me-0123456789abcdef"
    token_expire_days: int = 14
    # Public URL of the web app; used for links in emails
    frontend_url: str = "http://localhost:3000"
    # One-click "Try the demo" login for the seeded demo account
    demo_login_enabled: bool = True
    # Enables "Continue with Google" when set (an OAuth Web client ID from Google Cloud)
    google_client_id: str | None = None
    # Uploaded audio/video; point at a persistent volume in production (e.g. /data/media)
    media_dir: str = str(BACKEND_DIR / "data" / "media")
    max_media_mb: int = 200

    # Email. SMTP wins if SMTP_HOST is set, then Resend, otherwise emails are only logged.
    email_from: str = "Fireflies Clone <notifications@localhost>"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_starttls: bool = True
    resend_api_key: str | None = None
    # Allow http:// and localhost webhook targets (development only)
    allow_insecure_webhooks: bool = False

    # When unset, summaries fall back to the heuristic generator
    llm_api_key: str | None = None
    llm_model: str = "claude-opus-5-5"
    # Set to use an OpenAI-compatible provider (Gemini, Groq, OpenRouter, ...) instead of Anthropic
    llm_base_url: str | None = None
    # Speech-to-text model for recordings uploaded without a transcript (same provider/key as above)
    stt_model: str = "whisper-large-v3-turbo"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.db_path}"

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def email_transport(self) -> str:
        if self.smtp_host:
            return "smtp"
        if self.resend_api_key:
            return "resend"
        return "log"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
