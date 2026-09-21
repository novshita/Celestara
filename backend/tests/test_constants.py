"""Zodiac and nakshatra arithmetic, especially at boundaries.

Off-by-one errors here are invisible in the middle of a rashi and wrong at
every edge, so the edges are what get tested.
"""

from __future__ import annotations

import pytest

from app.services.astrology.common.constants import (
    DEGREES_PER_NAKSHATRA,
    DEGREES_PER_PADA,
    NAKSHATRA_COUNT,
    NAKSHATRA_LORD_CYCLE,
    NAKSHATRAS,
    RASHI_LORDS,
    RASHI_WESTERN_NAMES,
    RASHIS,
    nakshatra_index,
    nakshatra_lord,
    pada_number,
    rashi_index,
)


def test_definition_tables_are_complete():
    assert len(RASHIS) == 12
    assert len(RASHI_LORDS) == 12
    assert len(RASHI_WESTERN_NAMES) == 12
    assert len(NAKSHATRAS) == NAKSHATRA_COUNT == 27
    assert len(NAKSHATRA_LORD_CYCLE) == 9


def test_nakshatra_span_is_thirteen_twenty():
    assert DEGREES_PER_NAKSHATRA == pytest.approx(13.0 + 20.0 / 60.0)
    assert DEGREES_PER_PADA == pytest.approx(3.0 + 20.0 / 60.0)


@pytest.mark.parametrize(
    ("longitude", "expected"),
    [
        (0.0, 0),
        (29.999, 0),
        (30.0, 1),
        (180.0, 6),
        (359.999, 11),
        (360.0, 0),  # wraps
        (-1.0, 11),  # negative normalises
    ],
)
def test_rashi_boundaries(longitude, expected):
    assert rashi_index(longitude) == expected


@pytest.mark.parametrize(
    ("longitude", "expected"),
    [
        (0.0, 0),
        (13.0 + 19.0 / 60.0, 0),
        (13.0 + 20.0 / 60.0, 1),
        (359.9999, 26),
        (360.0, 0),
    ],
)
def test_nakshatra_boundaries(longitude, expected):
    assert nakshatra_index(longitude) == expected


@pytest.mark.parametrize(
    ("longitude", "expected"),
    [
        (0.0, 1),
        (3.0 + 19.0 / 60.0, 1),
        (3.0 + 20.0 / 60.0, 2),
        (6.0 + 40.0 / 60.0, 3),
        (10.0, 4),
        (13.0 + 19.0 / 60.0, 4),
        (13.0 + 20.0 / 60.0, 1),  # next nakshatra restarts at pada 1
    ],
)
def test_pada_boundaries(longitude, expected):
    assert pada_number(longitude) == expected


def test_pada_is_always_in_range():
    """Sampled across the whole circle, never 0 and never 5."""
    for step in range(0, 36000):
        assert 1 <= pada_number(step / 100.0) <= 4


def test_every_exact_division_boundary_opens_its_own_division():
    """Exhaustive boundary sweep.

    Floating-point spans made exact boundaries fall into the *previous*
    division: `pada_number(10.0)` returned 3 instead of 4 because
    `10.0 // (360/108)` is 2.9999... Checking all 108 pada, 27 nakshatra and
    12 rashi boundaries catches that class of error wherever it reappears,
    rather than relying on one hand-picked case.
    """
    for pada in range(108):
        longitude = pada * 360.0 / 108.0
        assert pada_number(longitude) == pada % 4 + 1, (
            f"pada boundary {pada} at {longitude} classified as "
            f"{pada_number(longitude)}"
        )

    for nakshatra in range(27):
        longitude = nakshatra * 360.0 / 27.0
        assert nakshatra_index(longitude) == nakshatra, (
            f"nakshatra boundary {nakshatra} at {longitude} classified as "
            f"{nakshatra_index(longitude)}"
        )
        assert pada_number(longitude) == 1

    for rashi in range(12):
        longitude = rashi * 30.0
        assert rashi_index(longitude) == rashi


def test_divisions_are_contiguous_with_no_gaps():
    """Either side of every boundary must land in the expected division.

    `epsilon` is comfortably wider than the boundary snap tolerance (~3e-9
    degrees) so these cases exercise strict classification rather than the
    snap. It is still far finer than the ephemeris resolves.
    """
    epsilon = 1e-6

    for pada in range(108):
        longitude = pada * 360.0 / 108.0 + epsilon
        assert pada_number(longitude) == pada % 4 + 1

    for pada in range(1, 108):
        longitude = pada * 360.0 / 108.0 - epsilon
        assert pada_number(longitude) == (pada - 1) % 4 + 1


def test_snap_tolerance_is_far_below_ephemeris_resolution():
    """The snap must never be wide enough to reclassify a real position.

    Guards the tolerance itself: if someone widens `_BOUNDARY_SNAP` to paper
    over a bug, a position meaningfully inside a division would start
    reporting the next one.
    """
    from app.services.astrology.common.constants import _BOUNDARY_SNAP

    snap_degrees = _BOUNDARY_SNAP * 360.0 / 108.0
    one_milliarcsecond = 1.0 / 3_600_000.0

    assert snap_degrees < one_milliarcsecond


def test_lord_cycle_repeats_every_nine_nakshatras():
    for index in range(NAKSHATRA_COUNT):
        assert nakshatra_lord(index) == NAKSHATRA_LORD_CYCLE[index % 9]

    assert nakshatra_lord(0) == "Ketu"  # Ashwini
    assert nakshatra_lord(3) == "Moon"  # Rohini
    assert nakshatra_lord(9) == "Ketu"  # Magha, cycle restarts


def test_vimshottari_lord_order_totals_one_hundred_twenty_years():
    """The nine lords' periods sum to the 120-year Vimshottari cycle.

    Asserted here because the lord *order* in NAKSHATRA_LORD_CYCLE is what the
    Dasha timeline will index into, and a reordering would be silent.
    """
    periods = {
        "Ketu": 7, "Venus": 20, "Sun": 6, "Moon": 10, "Mars": 7,
        "Rahu": 18, "Jupiter": 16, "Saturn": 19, "Mercury": 17,
    }

    assert sum(periods.values()) == 120
    assert set(NAKSHATRA_LORD_CYCLE) == set(periods)
