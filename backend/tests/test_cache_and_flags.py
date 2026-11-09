"""The calculation cache (engineering spec §28) and feature flags (§38)."""

from __future__ import annotations

import datetime as dt

import pytest

from app.core.cache import TTLCache, cached_calculation, clear_calculation_caches
from app.core.config import DEFAULT_CALCULATION_CONFIG, CalculationConfig
from app.core.flags import Flag, is_enabled
from app.domain.birth_data import BirthData, BirthTimeConfidence
from app.services.astrology.compare.service import calculate_comparison
from app.services.astrology.vedic.d1 import calculate_d1_chart
from app.services.astrology.western.chart import calculate_western_chart
from app.services.astrology.vedic.dasha import calculate_vimshottari


def _birth(day: int = 15) -> BirthData:
    return BirthData(
        birth_date=dt.date(1990, 8, day),
        birth_time=dt.time(14, 30),
        time_confidence=BirthTimeConfidence.EXACT,
        latitude=18.9756,
        longitude=72.8258,
        timezone_name="Asia/Kolkata",
    )


# --- TTLCache -------------------------------------------------------------


class _Clock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now


def test_cache_returns_what_was_stored():
    cache = TTLCache(max_size=2, ttl_seconds=10)
    cache.put("a", 1)

    assert cache.get("a") == (True, 1)
    assert cache.get("b") == (False, None)


def test_entries_expire_after_the_ttl():
    clock = _Clock()
    cache = TTLCache(max_size=2, ttl_seconds=10, clock=clock)
    cache.put("a", 1)

    clock.now = 10
    assert cache.get("a") == (True, 1)
    clock.now = 10.5
    assert cache.get("a") == (False, None)
    assert len(cache) == 0


def test_least_recently_used_entry_is_evicted():
    cache = TTLCache(max_size=2, ttl_seconds=10)
    cache.put("a", 1)
    cache.put("b", 2)
    cache.get("a")  # "b" is now the least recently used
    cache.put("c", 3)

    assert cache.get("b") == (False, None)
    assert cache.get("a")[0] and cache.get("c")[0]


def test_zero_size_disables_caching():
    cache = TTLCache(max_size=0, ttl_seconds=10)
    cache.put("a", 1)

    assert cache.get("a") == (False, None)


# --- The decorator --------------------------------------------------------


def _counting():
    calls = []

    @cached_calculation("test")
    def calculate(birth, config=DEFAULT_CALCULATION_CONFIG, engine=None):
        calls.append((birth, config, engine))
        return object()

    return calculate, calls


def test_same_inputs_are_calculated_once():
    calculate, calls = _counting()

    first = calculate(_birth())
    second = calculate(_birth(), DEFAULT_CALCULATION_CONFIG)

    assert first is second
    assert len(calls) == 1


def test_different_birth_data_is_a_different_entry():
    calculate, calls = _counting()

    assert calculate(_birth(15)) is not calculate(_birth(16))
    assert len(calls) == 2


def test_configuration_and_version_are_part_of_the_key():
    calculate, calls = _counting()
    birth = _birth()

    base = calculate(birth)
    other_orb = calculate(birth, CalculationConfig(aspect_orb_degrees=5.0))
    new_version = calculate(birth, CalculationConfig(calculation_version="9.9.9"))

    assert len({id(base), id(other_orb), id(new_version)}) == 3
    assert len(calls) == 3


def test_a_caller_supplied_engine_bypasses_the_cache():
    calculate, calls = _counting()
    engine = object()

    calculate(_birth())
    calculate(_birth(), engine=engine)
    calculate(_birth(), engine=engine)

    assert len(calls) == 3
    assert calls[1][2] is engine


# --- The real calculations ------------------------------------------------


@pytest.mark.parametrize(
    "calculation",
    [
        calculate_d1_chart,
        calculate_western_chart,
        calculate_vimshottari,
        calculate_comparison,
    ],
)
def test_cached_result_is_identical_to_a_fresh_one(calculation):
    """A cache hit must be indistinguishable from recalculating."""
    clear_calculation_caches()
    birth = _birth()

    first = calculation(birth)
    cached = calculation(birth)
    clear_calculation_caches()
    fresh = calculation(birth)

    assert cached is first
    assert cached == fresh


def test_transits_are_not_cached_here():
    """Time-dependent results must never go through this cache."""
    from app.services.astrology.transit import service

    assert not hasattr(service.calculate_transits, "__wrapped__")


# --- Feature flags ---------------------------------------------------------


def test_a_flag_uses_its_default_when_unset(monkeypatch):
    monkeypatch.delenv("FEATURE_PATTERN_DETECTION", raising=False)

    assert is_enabled(Flag.PATTERN_DETECTION) is True


@pytest.mark.parametrize("value", ["0", "false", "No", "OFF"])
def test_a_flag_can_be_turned_off(monkeypatch, value):
    monkeypatch.setenv("FEATURE_PATTERN_DETECTION", value)

    assert is_enabled(Flag.PATTERN_DETECTION) is False


@pytest.mark.parametrize("value", ["1", "true", "Yes", "ON"])
def test_a_flag_can_be_turned_on(monkeypatch, value):
    monkeypatch.setenv("FEATURE_PATTERN_DETECTION", value)

    assert is_enabled(Flag.PATTERN_DETECTION) is True


def test_an_unrecognised_value_falls_back_to_the_default(monkeypatch):
    monkeypatch.setenv("FEATURE_PATTERN_DETECTION", "maybe")

    assert is_enabled(Flag.PATTERN_DETECTION) is True
