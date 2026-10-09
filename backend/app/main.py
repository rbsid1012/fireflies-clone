from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import SessionLocal, fts5_available, upgrade_to_head
from app.seed.seed import seed_if_empty
from app.services import retention_service
from app.errors import register_error_handlers
from app.routers import (
    account, action_items, api_keys, ask, auth, export, integrations, media, meetings, people, search, settings as settings_router,
    speakers, summary, tags, transcript, insights,
)
from app.schemas.health import HealthOut


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.is_production and settings.secret_key.startswith("dev-only"):
        raise RuntimeError("Set SECRET_KEY to a long random value before running in production.")
    if not fts5_available():
        raise RuntimeError("SQLite was built without FTS5; global search cannot work.")
    upgrade_to_head()
    if settings.seed_on_startup:
        with SessionLocal() as db:
            seed_if_empty(db)
    with SessionLocal() as db:
        retention_service.purge_all(db)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Fireflies Clone API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_error_handlers(app)
    for module in (
        auth, account, settings_router, api_keys, integrations, media, meetings, transcript, summary, export, ask,
        action_items, search, people, tags, insights, speakers,
    ):
        app.include_router(module.router)

    @app.get("/api/health", response_model=HealthOut)
    def health() -> HealthOut:
        return HealthOut(status="ok")

    return app


app = create_app()
