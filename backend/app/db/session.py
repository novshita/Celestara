"""Database engine and session management.

Reads `DATABASE_URL` from the environment, following the same convention as
`app/core/logging.py` (`LOG_LEVEL`): no settings framework, a plain
`os.getenv` with a documented default, because the application does not yet
have enough environment-driven configuration to justify one.

The default is a local SQLite file so `uvicorn app.main:app` works with zero
setup, matching the README's "clone and run" instructions. Engineering spec
§4 names PostgreSQL + pgvector as the production store; SQLAlchemy's engine
is created from a single URL, so moving to Postgres is a `DATABASE_URL`
change, not a code change - the pgvector-specific column type is deferred
along with the RAG feature that needs it.
"""

from __future__ import annotations

import os
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

DEFAULT_DATABASE_URL = "sqlite:///./celestara.db"

DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)

#: SQLite enforces one connection per thread by default, which breaks under
#: FastAPI's threaded test client and worker pool, so it needs
#: `check_same_thread=False`; Postgres takes its own, separate options.
_connect_args: dict = {}
if DATABASE_URL.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}
elif DATABASE_URL.startswith("postgresql"):
    # Timestamps come back in the connection's timezone, which would otherwise
    # be whatever the database server happens to be set to. Pin it to UTC so the
    # API's output does not depend on server configuration (see core/timeutil).
    _connect_args = {"options": "-c timezone=UTC"}

engine = create_engine(DATABASE_URL, connect_args=_connect_args)

SessionLocal = sessionmaker(autoflush=False, autocommit=False, bind=engine)


def get_db() -> Iterator[Session]:
    """FastAPI dependency yielding a request-scoped session.

    Closed in `finally` so a session is released even when a route raises -
    otherwise a failed request would leak a connection for the life of the
    pool.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
