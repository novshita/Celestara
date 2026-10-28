"""Transits across a period: ingresses and stations, found by sampling and
bisection. Uses the real Swiss Ephemeris at fixed dates, so the assertions
are about internal consistency (an event really is where it says it is)
plus a few well-known sky facts."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import DEFAULT_CALCULATION_CONFIG
from app.domain.birth_data import BirthData
from app.services.ai.context import format_period_transit_context
from app.services.astrology.common.constants import RASHIS
from app.services.astrology.common.swisseph_engine import SwissEphemerisEngine
from app.services.astrology.transit.period import (
    MAX_PERIOD_DAYS,
    calculate_period_transits,
)
from app.services.astrology.transit.service import build_snapshot

START = datetime(2026, 10, 28, tzinfo=timezone.utc)
BIRTH = BirthData(
    birth_date="1990-08-15",
    birth_time="14:30:00",
    time_confidence="EXACT",
    latitude=18.9756,
    longitude=72.8258,
    timezone_name="Asia/Kolkata",
)
UNKNOWN_TIME = BirthData(
    birth_date="1990-08-15",
    time_confidence="UNKNOWN",
    latitude=18.9756,
    longitude=72.8258,
)


@pytest.fixture(scope="module")
def month():
    return calculate_period_transits(BIRTH, 30, at=START)


def _position(graha, moment):
    engine = SwissEphemerisEngine(DEFAULT_CALCULATION_CONFIG)
    return build_snapshot(moment, DEFAULT_CALCULATION_CONFIG, engine).position(graha)


def test_events_are_chronological_and_inside_the_period(month):
    moments = [event.moment for event in month.events]
    assert moments == sorted(moments)
    assert all(START <= m <= month.end for m in moments)
    assert month.end == START + timedelta(days=30)


def test_known_sky_facts_for_late_2026(month):
    found = {(e.kind, e.graha, e.rashi) for e in month.events}
    assert ("ingress", "Jupiter", "Simha") in found  # Jupiter enters Leo
    assert ("ingress", "Sun", "Vrischika") in found  # Sun enters Scorpio
    assert ("station_direct", "Mercury", "Tula") in found


def test_the_moon_is_never_an_event(month):
    assert "Moon" not in {e.graha for e in month.events}


def test_nodes_never_station(month):
    assert not [e for e in month.events if e.graha in {"Rahu", "Ketu"} and e.kind != "ingress"]


def test_an_ingress_moment_is_the_first_minute_in_the_new_rashi(month):
    ingresses = [e for e in month.events if e.kind == "ingress"]
    assert ingresses
    for event in ingresses:
        after = _position(event.graha, event.moment)
        before = _position(event.graha, event.moment - timedelta(minutes=1))
        assert after.rashi == event.rashi
        assert before.rashi == event.from_rashi


def test_a_station_moment_is_where_the_direction_flips(month):
    stations = [e for e in month.events if e.kind != "ingress"]
    assert stations
    for event in stations:
        now_retro = event.kind == "station_retrograde"
        assert _position(event.graha, event.moment).retrograde is now_retro
        before = _position(event.graha, event.moment - timedelta(minutes=1))
        assert before.retrograde is not now_retro


def test_event_moments_are_whole_minutes(month):
    assert all(e.moment.second == 0 and e.moment.microsecond == 0 for e in month.events)


def test_bhavas_are_counted_from_the_natal_ascendant_and_moon(month):
    asc = RASHIS.index(month.start.natal_ascendant_rashi)
    moon = RASHIS.index(month.start.natal_moon_rashi)

    for event in month.events:
        landed = RASHIS.index(event.rashi)
        assert event.bhava_from_ascendant == (landed - asc) % 12 + 1
        assert event.bhava_from_moon == (landed - moon) % 12 + 1


def test_unknown_birth_time_withholds_ascendant_bhavas_only():
    report = calculate_period_transits(UNKNOWN_TIME, 30, at=START)

    assert report.events
    assert all(e.bhava_from_ascendant is None for e in report.events)
    assert "bhava_from_ascendant" in report.unavailable


def test_a_quiet_period_reports_no_events():
    # Rahu/Ketu and the slow grahas rarely all hold still, so search for a
    # genuinely quiet one-day window rather than assuming a date.
    for offset in range(0, 40):
        report = calculate_period_transits(BIRTH, 1, at=START + timedelta(days=offset))
        if not report.events:
            assert "None" in format_period_transit_context(report)
            return
    pytest.fail("no quiet day found to test the empty case")


@pytest.mark.parametrize("days", [0, -1, MAX_PERIOD_DAYS + 1])
def test_days_out_of_range_are_rejected(days):
    with pytest.raises(ValueError):
        calculate_period_transits(BIRTH, days, at=START)


def test_the_longest_period_is_still_fast():
    import time

    started = time.perf_counter()
    calculate_period_transits(BIRTH, MAX_PERIOD_DAYS, at=START)
    assert time.perf_counter() - started < 5


def test_context_lists_events_with_times_and_places(month):
    text = format_period_transit_context(month)

    assert "Changes during the period" in text
    assert "Jupiter moves from Karka into Simha" in text
    assert "turns direct in Tula" in text
    assert "UTC:" in text
