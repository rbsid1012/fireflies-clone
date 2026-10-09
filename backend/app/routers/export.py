from typing import Annotated

from fastapi import APIRouter, Query, Response

from app.deps import CurrentUser, DbSession
from app.schemas.common import ERROR_RESPONSES
from app.services.export_service import ExportFormat, export_meeting

router = APIRouter(prefix="/api/meetings/{meeting_id}/export", tags=["export"])


@router.get(
    "", responses={**ERROR_RESPONSES, 200: {"content": {"text/markdown": {}, "text/plain": {}, "application/pdf": {}}}},
    response_class=Response,
)
def export(meeting_id: int, db: DbSession, user: CurrentUser, format: Annotated[ExportFormat, Query()] = "md"):
    filename, body, media_type = export_meeting(db, user, meeting_id, format)
    return Response(body, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{filename}"'})
