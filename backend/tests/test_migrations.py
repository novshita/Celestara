"""Schema migrations (app/db/migrate.py).

Each test builds its own throwaway SQLite file, so none of them touch the
application database.
"""

from __future__ import annotations

import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

from app.db.migrate import _MIGRATIONS_DIR, BASELINE_REVISION, upgrade_to_head
from app.db.models import Base

#: The tables the baseline revision creates - what every database made before
#: migrations existed contains, and nothing newer.
BASELINE_TABLES = ["users", "auth_sessions", "birth_profiles", "journal_entries"]
TABLES = set(Base.metadata.tables)


def _head() -> str:
    config = Config()
    config.set_main_option("script_location", str(_MIGRATIONS_DIR))
    return ScriptDirectory.from_config(config).get_current_head()


@pytest.fixture
def engine(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    yield engine
    engine.dispose()


def _tables(engine) -> set[str]:
    return set(inspect(engine).get_table_names())


def _version(engine) -> str:
    with engine.connect() as connection:
        return connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()


def test_a_new_database_gets_the_full_schema(engine):
    upgrade_to_head(engine)

    assert TABLES <= _tables(engine)
    assert _version(engine) == _head()


def test_running_it_again_changes_nothing(engine):
    upgrade_to_head(engine)
    upgrade_to_head(engine)

    assert _version(engine) == _head()
    assert TABLES <= _tables(engine)


def test_migrations_produce_exactly_the_schema_the_models_declare(engine):
    """The drift guard: a model change without a migration fails here."""
    upgrade_to_head(engine)

    with engine.connect() as connection:
        context = MigrationContext.configure(connection, opts={"compare_type": True})
        assert compare_metadata(context, Base.metadata) == []


def test_a_pre_migration_database_keeps_its_data_and_is_stamped(engine):
    # What every database made before migrations existed looks like: the
    # baseline tables, built by `create_all`, with no version record.
    Base.metadata.create_all(
        bind=engine, tables=[Base.metadata.tables[name] for name in BASELINE_TABLES]
    )
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO users (email, password_hash) VALUES ('a@example.com', 'x')")
        )
    assert "alembic_version" not in _tables(engine)

    upgrade_to_head(engine)

    with engine.connect() as connection:
        assert connection.execute(text("SELECT email FROM users")).scalar_one() == "a@example.com"
    # Stamped at the baseline, then carried forward to the newest revision.
    assert _version(engine) == _head()
    assert TABLES <= _tables(engine)


def test_a_partial_database_is_not_mistaken_for_a_pre_migration_one(engine):
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))

    # Stamping it would hide that the other tables are missing; the baseline
    # migration instead collides with the existing table and says so.
    with pytest.raises(Exception, match="users"):
        upgrade_to_head(engine)


def test_every_revision_can_be_downgraded_to_nothing(engine):
    from alembic import command

    upgrade_to_head(engine)
    config = Config()
    config.set_main_option("script_location", str(_MIGRATIONS_DIR))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.downgrade(config, "base")

    assert not (TABLES & _tables(engine))


def test_the_baseline_revision_is_still_the_first():
    assert BASELINE_REVISION == "0001"
