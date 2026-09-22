"""Aspect detection.

Aspects are the only substantially new calculation in the Western work, so
they are tested against synthetic positions where the right answer is known by
construction rather than read off the engine.
"""

from __future__ import annotations

import pytest

from app.core.config import DEFAULT_CALCULATION_CONFIG
from app.services.astrology.common.ephemeris import BodyPosition
from app.services.astrology.western.aspects import find_aspects, separation
from app.services.astrology.western.constants import MAJOR_ASPECTS

CONFIG = DEFAULT_CALCULATION_CONFIG


def _body(name: str, longitude: float, speed: float = 1.0) -> BodyPosition:
    return BodyPosition(
        body=name,
        longitude=longitude % 360.0,
        latitude=0.0,
        distance_au=1.0,
        speed_longitude=speed,
    )


def _pair(first_lon: float, second_lon: float, *, first_speed=1.0, second_speed=0.0):
    positions = {
        "A": _body("A", first_lon, first_speed),
        "B": _body("B", second_lon, second_speed),
    }
    return find_aspects(positions, ("A", "B"), CONFIG)


# --- Separation -----------------------------------------------------------


@pytest.mark.parametrize(
    ("first", "second", "expected"),
    [
        (0.0, 0.0, 0.0),
        (0.0, 90.0, 90.0),
        (0.0, 180.0, 180.0),
        (0.0, 270.0, 90.0),  # never exceeds 180
        (350.0, 10.0, 20.0),  # across the wrap
        (10.0, 350.0, 20.0),
    ],
)
def test_separation_is_the_shorter_arc(first, second, expected):
    assert separation(first, second) == pytest.approx(expected)


# --- Detection ------------------------------------------------------------


@pytest.mark.parametrize(
    ("angle", "name"),
    [(0.0, "Conjunction"), (60.0, "Sextile"), (90.0, "Square"),
     (120.0, "Trine"), (180.0, "Opposition")],
)
def test_each_major_aspect_is_found_when_exact(angle, name):
    aspects = _pair(0.0, angle)

    assert len(aspects) == 1
    assert aspects[0].aspect == name
    assert aspects[0].orb == pytest.approx(0.0)
    assert aspects[0].exact_angle == angle


def test_aspect_is_found_across_the_zero_boundary():
    """A square from 350 to 80 degrees must still be a square."""
    aspects = _pair(350.0, 80.0)

    assert len(aspects) == 1
    assert aspects[0].aspect == "Square"


def test_nothing_is_found_at_an_unaspected_angle():
    """45 degrees is a semi-square, a minor aspect not in V1 scope."""
    assert _pair(0.0, 45.0) == ()


def test_orb_is_signed_by_direction():
    """Sign tells you which side of exact the aspect sits."""
    wide = _pair(0.0, 93.0)[0]
    narrow = _pair(0.0, 87.0)[0]

    assert wide.orb == pytest.approx(3.0)
    assert narrow.orb == pytest.approx(-3.0)


def test_aspect_just_inside_the_orb_is_found():
    aspects = _pair(0.0, 90.0 + CONFIG.aspect_orb_degrees - 0.01)

    assert len(aspects) == 1
    assert aspects[0].aspect == "Square"


def test_aspect_just_outside_the_orb_is_not_found():
    assert _pair(0.0, 90.0 + CONFIG.aspect_orb_degrees + 0.01) == ()


def test_sextile_uses_the_tighter_orb():
    """Conventionally allowed less latitude than the other major aspects."""
    inside = _pair(0.0, 60.0 + CONFIG.sextile_orb_degrees - 0.01)
    outside = _pair(0.0, 60.0 + CONFIG.sextile_orb_degrees + 0.01)

    assert len(inside) == 1
    assert outside == ()
    assert CONFIG.sextile_orb_degrees < CONFIG.aspect_orb_degrees


def test_orbs_are_configurable():
    """Practitioners disagree on orbs, so they are settings not constants."""
    tight = DEFAULT_CALCULATION_CONFIG.model_copy(
        update={"aspect_orb_degrees": 2.0}
    )
    positions = {"A": _body("A", 0.0), "B": _body("B", 95.0)}

    assert find_aspects(positions, ("A", "B"), CONFIG)
    assert find_aspects(positions, ("A", "B"), tight) == ()


# --- One aspect per pair --------------------------------------------------


def test_a_pair_yields_at_most_one_aspect():
    """Two simultaneous aspects between one pair is not a reading anyone uses."""
    wide = DEFAULT_CALCULATION_CONFIG.model_copy(
        update={"aspect_orb_degrees": 15.0, "sextile_orb_degrees": 15.0}
    )
    # 75 degrees is within 15 of both a sextile (60) and a square (90).
    positions = {"A": _body("A", 0.0), "B": _body("B", 76.0)}

    aspects = find_aspects(positions, ("A", "B"), wide)

    assert len(aspects) == 1


def test_the_closest_aspect_wins():
    wide = DEFAULT_CALCULATION_CONFIG.model_copy(
        update={"aspect_orb_degrees": 15.0, "sextile_orb_degrees": 15.0}
    )
    positions = {"A": _body("A", 0.0), "B": _body("B", 83.0)}

    aspects = find_aspects(positions, ("A", "B"), wide)

    assert aspects[0].aspect == "Square"  # 7 off a square, 23 off a sextile


def test_each_pair_appears_only_once():
    positions = {
        name: _body(name, angle)
        for name, angle in (("A", 0.0), ("B", 90.0), ("C", 180.0))
    }

    aspects = find_aspects(positions, ("A", "B", "C"), CONFIG)
    pairs = {frozenset((a.first, a.second)) for a in aspects}

    assert len(aspects) == len(pairs)


def test_no_body_aspects_itself():
    positions = {"A": _body("A", 0.0), "B": _body("B", 0.0)}

    for aspect in find_aspects(positions, ("A", "B"), CONFIG):
        assert aspect.first != aspect.second


# --- Applying and separating ---------------------------------------------


def test_aspect_is_applying_when_closing_on_exact():
    """A faster body approaching the exact angle from below."""
    aspects = _pair(0.0, 85.0, first_speed=0.0, second_speed=1.0)

    assert aspects[0].aspect == "Square"
    assert aspects[0].applying is True


def test_aspect_is_separating_when_moving_past_exact():
    aspects = _pair(0.0, 95.0, first_speed=0.0, second_speed=1.0)

    assert aspects[0].applying is False


def test_retrograde_motion_reverses_applying():
    """A retrograde body moving back toward exact is applying.

    Handled by extrapolating positions rather than comparing raw speeds, which
    would need a special case for negative motion.
    """
    forward = _pair(0.0, 95.0, first_speed=0.0, second_speed=1.0)
    backward = _pair(0.0, 95.0, first_speed=0.0, second_speed=-1.0)

    assert forward[0].applying is False
    assert backward[0].applying is True


def test_a_pair_with_equal_speeds_is_not_applying():
    """No relative motion means the orb is not closing."""
    aspects = _pair(0.0, 85.0, first_speed=1.0, second_speed=1.0)

    assert aspects[0].applying is False


# --- Ordering and tone ---------------------------------------------------


def test_aspects_are_ordered_tightest_first():
    """The closer to exact, the stronger an aspect is traditionally held."""
    positions = {
        "A": _body("A", 0.0),
        "B": _body("B", 95.0),   # square, 5 off
        "C": _body("C", 181.0),  # opposition, 1 off
        "D": _body("D", 123.0),  # trine, 3 off
    }

    aspects = find_aspects(positions, ("A", "B", "C", "D"), CONFIG)
    from_a = [a for a in aspects if "A" in (a.first, a.second)]

    assert [abs(a.orb) for a in from_a] == sorted(abs(a.orb) for a in from_a)
    assert from_a[0].second == "C"


@pytest.mark.parametrize(
    ("angle", "expected"),
    [
        (120.0, True),   # Trine
        (60.0, True),    # Sextile
        (90.0, False),   # Square
        (180.0, False),  # Opposition
        (0.0, None),     # Conjunction depends on the bodies
    ],
)
def test_traditional_tone_is_reported(angle, expected):
    """Conjunctions are neither: the meaning is interpretation, not geometry."""
    assert _pair(0.0, angle)[0].harmonious is expected


# --- Definitions ---------------------------------------------------------


def test_the_five_ptolemaic_aspects_are_defined():
    assert len(MAJOR_ASPECTS) == 5
    assert {d.angle for d in MAJOR_ASPECTS} == {0.0, 60.0, 90.0, 120.0, 180.0}


def test_only_the_sextile_uses_the_tight_orb():
    tight = [d.name for d in MAJOR_ASPECTS if d.uses_tight_orb]

    assert tight == ["Sextile"]


def test_no_aspect_angle_exceeds_half_a_circle():
    """Separation is measured as the shorter arc, so angles above 180 would
    never be matched."""
    for definition in MAJOR_ASPECTS:
        assert 0.0 <= definition.angle <= 180.0
