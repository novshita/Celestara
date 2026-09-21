"""Shared fixtures.

The reference subject is fixed so every assertion in the suite is about one
reproducible chart rather than a moving target.
"""

from __future__ import annotations

from datetime import date, time

import pytest

from app.core.config import DEFAULT_CALCULATION_CONFIG, CalculationConfig
from app.domain.birth_data import BirthData, BirthTimeConfidence
from app.services.astrology.common.swisseph_engine import SwissEphemerisEngine

#: Mumbai. Asia/Kolkata has never observed DST, which keeps the reference
#: chart free of transition effects; DST is exercised separately.
MUMBAI_LAT = 18.9756
MUMBAI_LON = 72.8258

#: 1990-08-15 14:30 IST == 09:00 UTC.
REFERENCE_JD_UT = 2448118.875


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
