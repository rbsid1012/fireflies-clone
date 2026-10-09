from alembic import context
from sqlalchemy import pool

from app.config import settings
from app.db import make_engine
from app.models import Base

config = context.config
target_metadata = Base.metadata


def _url() -> str:
    # A URL set programmatically (tests, upgrade_to_head(url)) wins over settings.
    return config.get_main_option("sqlalchemy.url") or settings.database_url


def include_object(obj, name, type_, reflected, compare_to):
    # The FTS5 virtual table and its shadow tables are managed by hand-written
    # SQL in migrations; keep autogenerate from trying to drop them.
    if type_ == "table" and name and name.startswith("transcript_fts"):
        return False
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=_url(), target_metadata=target_metadata, literal_binds=True,
        include_object=include_object, render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # SQLite cannot ALTER most constraints, so Alembic rebuilds tables (create new, copy, drop old,
    # rename). With foreign keys enforced, dropping the old parent table (e.g. `users`) would
    # cascade-delete every child row. SQLite's documented procedure is: foreign keys OFF while
    # rebuilding, then verify with foreign_key_check. We do exactly that.
    engine = make_engine(_url(), foreign_keys=False)
    with engine.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata,
            include_object=include_object, render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()
        violations = connection.exec_driver_sql("PRAGMA foreign_key_check").fetchall()
        if violations:
            raise RuntimeError(f"Migration left foreign key violations: {violations[:5]}")
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
