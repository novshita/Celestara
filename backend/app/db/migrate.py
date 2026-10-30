"""Bring the database schema up to date.

Replaces the `Base.metadata.create_all` that used to run at startup.
`create_all` can only create tables that are missing; it cannot add a column
to one that exists, so the first schema change to a database holding real
data would have had no safe path. Migrations (Alembic, under
`app/db/migrations`) record the schema version and apply each change once.

Databases created before migrations existed were built by `create_all` and
have the baseline tables but no version record. Those are stamped as being at
the baseline rather than migrated, which would otherwise try to create tables
that are already there.
"""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, inspect

from app.db.session import engine as default_engine

BASELINE_REVISION = "0001"

#: What the baseline revision creates; used to recognise a pre-migration
#: database. All of them, not any of them: a partial set is not a database
#: `create_all` made, and stamping it would hide the damage.
_BASELINE_TABLES = frozenset(
    {"users", "auth_sessions", "birth_profiles", "journal_entries"}
)

_MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def upgrade_to_head(engine: Engine | None = None) -> None:
    """Apply every migration that has not been applied yet. Safe to call on
    every startup: on an up-to-date database it does nothing."""
    engine = engine or default_engine

    config = Config()
    config.set_main_option("script_location", str(_MIGRATIONS_DIR))

    with engine.begin() as connection:
        config.attributes["connection"] = connection

        tables = set(inspect(connection).get_table_names())
        if "alembic_version" not in tables and _BASELINE_TABLES <= tables:
            command.stamp(config, BASELINE_REVISION)

        command.upgrade(config, "head")
