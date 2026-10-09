from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.people import ORM


class ApiKeyOut(ORM):
    id: int
    name: str
    prefix: str
    created_at: datetime
    last_used_at: datetime | None


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ApiKeyCreated(ApiKeyOut):
    """Returned once, at creation; the full key can't be retrieved again."""

    key: str


class IntegrationOut(ORM):
    id: int
    kind: str
    name: str
    enabled: bool
    last_status: str | None
    last_run_at: datetime | None
    created_at: datetime
    # Webhook integrations sign deliveries with this secret; Slack ones have none
    secret: str | None = None
    url_host: str


class IntegrationCreate(BaseModel):
    kind: str = Field(pattern="^(slack|webhook)$")
    name: str = Field(min_length=1, max_length=80)
    url: str = Field(min_length=8, max_length=500)


class IntegrationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    enabled: bool | None = None


class IntegrationTestOut(BaseModel):
    result: str


class EmailLogOut(ORM):
    id: int
    to_email: str
    subject: str
    transport: str
    status: str
    error: str | None
    meeting_id: int | None
    created_at: datetime


class EmailLogDetail(EmailLogOut):
    html: str
    text: str


class SecurityCheck(BaseModel):
    id: str
    label: str
    done: bool
    detail: str


class SecurityOverview(BaseModel):
    done: int
    total: int
    checks: list[SecurityCheck]
