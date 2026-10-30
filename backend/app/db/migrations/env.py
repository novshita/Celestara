"""Alembic environment: migrations run against the application's own engine
and metadata, so there is one source of truth for both the database URL
(`DATABASE_URL`) and the schema (`app.db.models`)."""

from __future__ import annotations

from alembic import context

from app.db.models import Base
from app.db.session import engine

target_metadata = Base.metadata


def run_migrations() -> None:
    # `app.db.migrate` hands in an open connection so a migration runs on the
    # same engine (and, in tests, the same in-memory database) as the app.
    connection = context.config.attributes.get("connection")
    if connection is None:
        with engine.connect() as connection:
            _run(connection)
    else:
        _run(connection)


def _run(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # SQLite cannot ALTER most things in place; batch mode rewrites the
        # table instead. Harmless on other databases.
        render_as_batch=connection.dialect.name == "sqlite",
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


run_migrations()
