import os
import tempfile

# Must run before any `app` import so tests never touch the developer database.
os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(prefix="ff_tests_"), "app.db")

from collections.abc import Iterator  # noqa: E402

import pytest  # noqa: E402
from fastapi import Depends  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

from app.config import settings  # noqa: E402
from app.db import get_db, make_engine, upgrade_to_head  # noqa: E402
from app.deps import current_user  # noqa: E402
from app.deps import session_factory as session_factory_dependency  # noqa: E402
from app.deps import llm as llm_dependency  # noqa: E402
from app.main import create_app  # noqa: E402
from app.seed.seed import seed_if_empty  # noqa: E402
from app.services.people_service import get_default_user  # noqa: E402


@pytest.fixture(autouse=True)
def _ignore_developer_secrets(monkeypatch) -> None:
    """A developer's backend/.env (Google client ID, LLM key, SMTP...) must not change test outcomes."""
    for name in ("google_client_id", "llm_api_key", "llm_base_url", "smtp_host", "resend_api_key"):
        monkeypatch.setattr(settings, name, None)


@pytest.fixture()
def session_factory(tmp_path) -> Iterator[sessionmaker]:
    """A fresh database built by the real Alembic migrations (FTS + triggers included)."""
    url = f"sqlite:///{tmp_path / 'test.db'}"
    upgrade_to_head(url)
    engine = make_engine(url)
    yield sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    engine.dispose()


@pytest.fixture()
def db(session_factory) -> Iterator[Session]:
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def llm_holder() -> dict:
    """Tests set holder['llm'] to a FakeLLM to enable LLM features."""
    return {"llm": None}


def _build_app(session_factory, llm_holder, *, authenticated: bool):
    app = create_app()

    def _get_db():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _get_db
    app.dependency_overrides[llm_dependency] = lambda: llm_holder["llm"]
    app.dependency_overrides[session_factory_dependency] = lambda: session_factory
    if authenticated:
        # Most API tests are about features, not login: act as the demo user. Auth has its own tests.
        def _demo_user(db=Depends(get_db)):
            return get_default_user(db)

        app.dependency_overrides[current_user] = _demo_user
    return app


@pytest.fixture(autouse=True)
def isolated_media_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "media_dir", str(tmp_path / "media"))


@pytest.fixture()
def client(session_factory, llm_holder) -> Iterator[TestClient]:
    """API client over an empty (unseeded) database, signed in as the demo user."""
    yield TestClient(_build_app(session_factory, llm_holder, authenticated=True))


@pytest.fixture()
def anon_client(session_factory, llm_holder) -> Iterator[TestClient]:
    """API client with the real authentication dependency (for auth tests)."""
    yield TestClient(_build_app(session_factory, llm_holder, authenticated=False))


@pytest.fixture()
def seeded(client, session_factory) -> TestClient:
    """API client over the seeded demo database."""
    with session_factory() as session:
        seed_if_empty(session)
    return client
