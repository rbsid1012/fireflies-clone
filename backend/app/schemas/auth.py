import re

from pydantic import BaseModel, Field, field_validator

from app.schemas.people import UserOut

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _email(v: str) -> str:
    v = v.strip().lower()
    if not _EMAIL.match(v) or len(v) > 255:
        raise ValueError("Enter a valid email address")
    return v


def _password(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(v) > 200:
        raise ValueError("Password is too long")
    return v


class SignupIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str
    password: str

    _e = field_validator("email")(_email)
    _p = field_validator("password")(_password)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v:
            raise ValueError("Enter your name")
        return v


class LoginIn(BaseModel):
    email: str
    password: str = Field(max_length=200)

    _e = field_validator("email")(_email)


class GoogleIn(BaseModel):
    credential: str = Field(min_length=10, max_length=5000)


class ForgotPasswordIn(BaseModel):
    email: str

    _e = field_validator("email")(_email)


class ResetPasswordIn(BaseModel):
    token: str = Field(min_length=10, max_length=2000)
    password: str

    _p = field_validator("password")(_password)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(max_length=200)
    new_password: str

    _p = field_validator("new_password")(_password)


class ProfileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    avatar_url: str | None = Field(default=None, max_length=500)


class DeleteAccountIn(BaseModel):
    # Required for accounts that have a password; ignored for password-less (Google/demo) accounts
    password: str | None = Field(default=None, max_length=200)


class AuthOut(BaseModel):
    token: str
    user: UserOut


class AuthConfigOut(BaseModel):
    google_client_id: str | None
    demo_login_enabled: bool
    email_transport: str
    # The model that writes answers and summaries, or null when only the built-in heuristics are available
    ai_model: str | None = None
    # True when a recording can be uploaded on its own and transcribed on the server
    can_transcribe: bool = False


class MessageOut(BaseModel):
    message: str
