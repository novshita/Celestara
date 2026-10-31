"""Shared fixtures.

The reference subject is fixed so every assertion in the suite is about one
reproducible chart rather than a moving target.
"""

from __future__ import annotations

from datetime import date, time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import DEFAULT_CALCULATION_CONFIG, CalculationConfig
from app.core.rate_limit import ai_rate_limiter
from app.db.models import Base
from app.db.session import get_db
from app.domain.birth_data import BirthData, BirthTimeConfidence
from app.main import app
from app.services.astrology.common.swisseph_engine import SwissEphemerisEngine

#: Mumbai. Asia/Kolkata has never observed DST, which keeps the reference
#: chart free of transition effects; DST is exercised separately.
MUMBAI_LAT = 18.9756
MUMBAI_LON = 72.8258

#: 1990-08-15 14:30 IST == 09:00 UTC.
REFERENCE_JD_UT = 2448118.875


@pytest.fixture(autouse=True)
def _fresh_ai_rate_limiter():
    """The limiter is a process-wide singleton and every test client shares
    one address, so without this a test's AI calls would count against the
    next test's allowance. Tests that exercise the limit itself set their own
    `AI_RATE_LIMIT_PER_MINUTE` via `monkeypatch`."""
    ai_rate_limiter.reset()
    yield


@pytest.fixture
def config() -> CalculationConfig:
    return DEFAULT_CALCULATION_CONFIG


@pytest.fixture
def engine(config: CalculationConfig) -> SwissEphemerisEngine:
    return SwissEphemerisEngine(config)


@pytest.fixture
def reference_birth() -> BirthData:
    """Exact birth time, no DST in the zone."""
    return BirthData(
        birth_date=date(1990, 8, 15),
        birth_time=time(14, 30),
        time_confidence=BirthTimeConfidence.EXACT,
        latitude=MUMBAI_LAT,
        longitude=MUMBAI_LON,
        timezone_name="Asia/Kolkata",
    )


@pytest.fixture
def unknown_time_birth() -> BirthData:
    """Same date and place, birth time unknown."""
    return BirthData(
        birth_date=date(1990, 8, 15),
        birth_time=None,
        time_confidence=BirthTimeConfidence.UNKNOWN,
        latitude=MUMBAI_LAT,
        longitude=MUMBAI_LON,
        timezone_name="Asia/Kolkata",
    )


@pytest.fixture(autouse=True)
def session_factory():
    """A fresh in-memory database for every test, wired in as the app's
    database, so no test ever touches the real one - important now that AI
    answers write an audit record even for anonymous callers.

    Yields the `sessionmaker`, so a test can look at what was stored. `StaticPool`
    keeps the single in-memory connection alive across the multiple threads
    FastAPI's `TestClient` uses; without it, each connection would see an
    empty (and separate) `:memory:` database.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(autoflush=False, autocommit=False, bind=engine)

    def override_get_db():
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield factory
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.fixture
def client(session_factory) -> TestClient:
    """A TestClient backed by this test's fresh in-memory database.

    Chart/dasha/transit/compare test modules define their own `client`
    fixture locally (a plain `TestClient(app)`) which shadows this one - they
    need no database of their own, but still share the isolated one above.
    """
    return TestClient(app)


@pytest.fixture
def make_user(client):
    """Registers a user and returns the headers that authenticate them, so a
    test can have several distinct users."""

    def _make(email: str = "astronaut@example.com") -> dict:
        credentials = {"email": email, "password": "correct horse battery"}
        client.post("/api/v1/auth/register", json=credentials)
        token = client.post("/api/v1/auth/login", json=credentials).json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _make
