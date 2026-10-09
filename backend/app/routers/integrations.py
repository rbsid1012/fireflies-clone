from fastapi import APIRouter, Response

from app.deps import CurrentUser, DbSession
from app.schemas.account import IntegrationCreate, IntegrationOut, IntegrationTestOut, IntegrationUpdate
from app.schemas.common import ERROR_RESPONSES
from app.services import integration_service

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.get("", response_model=list[IntegrationOut])
def list_integrations(db: DbSession, user: CurrentUser):
    return integration_service.list_integrations(db, user)


@router.post("", response_model=IntegrationOut, status_code=201, responses=ERROR_RESPONSES)
def create_integration(body: IntegrationCreate, db: DbSession, user: CurrentUser):
    return integration_service.create_integration(db, user, body.kind, " ".join(body.name.split()), body.url)


@router.patch("/{integration_id}", response_model=IntegrationOut, responses=ERROR_RESPONSES)
def update_integration(integration_id: int, body: IntegrationUpdate, db: DbSession, user: CurrentUser):
    return integration_service.update_integration(db, user, integration_id, name=body.name, enabled=body.enabled)


@router.delete("/{integration_id}", status_code=204, responses=ERROR_RESPONSES)
def delete_integration(integration_id: int, db: DbSession, user: CurrentUser):
    integration_service.delete_integration(db, user, integration_id)
    return Response(status_code=204)


@router.post("/{integration_id}/test", response_model=IntegrationTestOut, responses=ERROR_RESPONSES)
def test_integration(integration_id: int, db: DbSession, user: CurrentUser):
    """Send a sample delivery now and report what the other end answered."""
    return IntegrationTestOut(result=integration_service.send_test(db, user, integration_id))
