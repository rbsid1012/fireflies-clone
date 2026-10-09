from collections.abc import Iterator
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import BACKEND_DIR, settings


def make_engine(url: str, *, foreign_keys: bool = True) -> Engine:
    engine = create_engine(url, connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _set_pragmas(dbapi_conn, _record):
        cur = dbapi_conn.cursor()
        # SQLite ignores FKs (and therefore ON DELETE CASCADE) unless asked. Migrations turn them
        # off (see alembic/env.py): rebuilding a parent table would otherwise cascade-delete children.
        cur.execute(f"PRAGMA foreign_keys={'ON' if foreign_keys else 'OFF'}")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.close()

    return engine


Path(settings.db_path).parent.mkdir(parents=True, exist_ok=True)
engine = make_engine(settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def fts5_available(eng: Engine = engine) -> bool:
    """The search feature depends on SQLite being compiled with FTS5."""
    with eng.connect() as conn:
        rows = conn.exec_driver_sql("PRAGMA compile_options").fetchall()
    return any("ENABLE_FTS5" in r[0] for r in rows)


def upgrade_to_head(url: str | None = None, revision: str = "head") -> None:
    """Run Alembic migrations (to `revision`). Used on app startup and by the test suite."""
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    if url:
        cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, revision)


def downgrade_to(url: str, revision: str) -> None:
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", url)
    command.downgrade(cfg, revision)
