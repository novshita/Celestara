"""Tests for the reference-chart comparison logic itself.

The harness in `reference_support.py` is what will tell us whether the
calculation layer is correct, so it has to be trustworthy before any real
fixture arrives. A comparison that silently passes everything would convert
the verification gap into false confidence, which is worse than the gap.

Every test here feeds the comparison deliberately wrong data and asserts it
complains. The synthetic fixtures below are built *from* our own output on
purpose - that is circular for verifying astrology, but it is exactly what is
needed to verify the comparison, because it isolates the one value under test.
"""

from __future__ import annotations

import json
from datetime import date, time

import pytest
from pydantic import ValidationError

from app.domain.birth_data import BirthData, BirthTimeConfidence
from app.services.astrology.common.constants import DEGREES_PER_RASHI, RASHIS
from app.services.astrology.vedic.d1 import calculate_d1_chart
from tests.reference_support import (
    ReferenceChart,
    ReferenceGraha,
    ReferencePosition,
    angular_difference,
    compare_ascendant,
    compare_ascendant_rashi,
    compare_longitudes,
    compare_nakshatras,
    compare_padas,
    compare_retrogrades,
    compare_rashis,
    describe_longitude,
    discover_references,
    load_reference,
    rashi_index_from_name,
)

BIRTH = BirthData(
    birth_date=date(1990, 8, 15),
    birth_time=time(14, 30),
    time_confidence=BirthTimeConfidence.EXACT,
    latitude=18.9756,
    longitude=72.8258,
    timezone_name="Asia/Kolkata",
)


@pytest.fixture
def chart():
    return calculate_d1_chart(BIRTH)


def _position_at(longitude: float, **extra) -> dict:
    """Split a longitude into the sign/deg/min/sec a fixture records."""
    index = int(longitude % 360.0 // DEGREES_PER_RASHI)
    within = longitude % DEGREES_PER_RASHI
    degrees = int(within)
    minutes_full = (within - degrees) * 60.0
    minutes = int(minutes_full)
    return {
        "rashi": RASHIS[index],
        "deg": degrees,
        "min": minutes,
        "sec": (minutes_full - minutes) * 60.0,
        **extra,
    }


def _reference(chart, *, ascendant_offset=0.0, graha_offsets=None, **kwargs):
    """Build a fixture from our chart, optionally perturbed."""
    graha_offsets = graha_offsets or {}

    return ReferenceChart(
        source="Synthetic harness fixture",
        birth=BIRTH,
        ascendant=ReferencePosition(
            **_position_at(chart.ascendant.longitude + ascendant_offset)
        ),
        placements=tuple(
            ReferenceGraha(
                graha=placement.graha,
                **_position_at(
                    placement.longitude + graha_offsets.get(placement.graha, 0.0)
                ),
            )
            for placement in chart.placements
        ),
        **kwargs,
    )


# --- Primitives -----------------------------------------------------------


@pytest.mark.parametrize(
    ("first", "second", "expected"),
    [
        (10.0, 10.0, 0.0),
        (10.0, 11.0, 1.0),
        (359.0, 1.0, 2.0),  # across the wrap
        (1.0, 359.0, 2.0),
        (0.0, 180.0, 180.0),
        (0.0, 181.0, 179.0),  # never more than 180
    ],
)
def test_angular_difference_handles_the_wrap(first, second, expected):
    assert angular_difference(first, second) == pytest.approx(expected)


def test_sign_names_accept_both_spellings():
    assert rashi_index_from_name("Vrischika") == 7
    assert rashi_index_from_name("Scorpio") == 7
    assert rashi_index_from_name("  scorpio  ") == 7


def test_unknown_sign_name_is_rejected():
    with pytest.raises(ValueError, match="unknown rashi"):
        rashi_index_from_name("Ophiuchus")


def test_position_longitude_is_reconstructed_from_sign_and_degrees():
    position = ReferencePosition(rashi="Vrischika", deg=20, min=43, sec=39.13)

    # Vrischika starts at 210 degrees.
    assert position.longitude == pytest.approx(230.727536, abs=1e-4)


def test_describe_longitude_round_trips():
    for longitude in (0.0, 45.5, 230.727536, 359.999):
        rendered = describe_longitude(longitude)
        assert f"{longitude:.4f}" in rendered


# --- The comparison must catch a correct chart as correct -----------------


def test_matching_reference_produces_no_failures(chart):
    """Sanity floor: an exact match must not report anything."""
    reference = _reference(chart)

    assert compare_ascendant(chart, reference) == []
    assert compare_ascendant_rashi(chart, reference) == []
    assert compare_longitudes(chart, reference) == []
    assert compare_rashis(chart, reference) == []
    assert compare_retrogrades(chart, reference) == []


def test_differences_inside_tolerance_are_accepted(chart):
    """1 arcmin of disagreement is normal between implementations."""
    one_arcmin = 1.0 / 60.0
    reference = _reference(
        chart,
        ascendant_offset=one_arcmin,
        graha_offsets={"Sun": one_arcmin, "Moon": -one_arcmin},
    )

    assert compare_ascendant(chart, reference) == []
    assert compare_longitudes(chart, reference) == []


# --- The comparison must catch errors ------------------------------------


def test_ascendant_offset_beyond_tolerance_is_caught(chart):
    """Ten arcmin is well inside a sign but far outside tolerance."""
    reference = _reference(chart, ascendant_offset=10.0 / 60.0)

    failures = compare_ascendant(chart, reference)

    assert len(failures) == 1
    assert "Ascendant disagrees" in failures[0]
    assert "10.00 arcmin" in failures[0]


def test_ascendant_in_the_wrong_sign_is_caught(chart):
    """A 30-degree error, the signature of a tropical/sidereal frame mixup."""
    reference = _reference(chart, ascendant_offset=DEGREES_PER_RASHI)

    assert compare_ascendant(chart, reference)
    assert compare_ascendant_rashi(chart, reference)


def test_a_single_wrong_graha_is_caught(chart):
    reference = _reference(chart, graha_offsets={"Saturn": 5.0 / 60.0})

    failures = compare_longitudes(chart, reference)

    assert len(failures) == 1
    assert "Saturn" in failures[0]


def test_systematic_offset_is_reported_for_every_graha(chart):
    """An ayanamsa error moves every body by the same amount.

    The harness must surface all of them, since seeing one body wrong looks
    like a transcription slip while seeing nine looks like a misconfiguration.
    """
    half_degree = 0.5
    reference = _reference(
        chart,
        graha_offsets={placement.graha: half_degree for placement in chart.placements},
    )

    failures = compare_longitudes(chart, reference)

    assert len(failures) == 9
    assert all("30.00'" in failure for failure in failures)


def test_wrong_rashi_is_caught_separately_from_longitude(chart):
    reference = _reference(chart, graha_offsets={"Mars": DEGREES_PER_RASHI})

    assert compare_rashis(chart, reference)


def test_wrong_nakshatra_is_caught(chart):
    reference = ReferenceChart(
        source="Synthetic harness fixture",
        birth=BIRTH,
        placements=(
            ReferenceGraha(
                graha="Moon",
                **_position_at(chart.placement("Moon").longitude),
                nakshatra="Ashwini",  # actually Rohini
            ),
        ),
    )

    failures = compare_nakshatras(chart, reference)

    assert len(failures) == 1
    assert "Ashwini" in failures[0]
    assert "Rohini" in failures[0]


def test_wrong_pada_is_caught_and_reports_boundary_distance(chart):
    """The boundary distance is what distinguishes a bug from an edge case."""
    moon = chart.placement("Moon")
    wrong_pada = 1 if moon.nakshatra.pada != 1 else 2

    reference = ReferenceChart(
        source="Synthetic harness fixture",
        birth=BIRTH,
        placements=(
            ReferenceGraha(
                graha="Moon",
                **_position_at(moon.longitude),
                pada=wrong_pada,
            ),
        ),
    )

    failures = compare_padas(chart, reference)

    assert len(failures) == 1
    assert "pada boundary" in failures[0]


def test_wrong_retrograde_flag_is_caught(chart):
    """Catches a mean-vs-true node mixup, among other things."""
    saturn = chart.placement("Saturn")

    reference = ReferenceChart(
        source="Synthetic harness fixture",
        birth=BIRTH,
        placements=(
            ReferenceGraha(
                graha="Saturn",
                **_position_at(saturn.longitude),
                retrograde=not saturn.retrograde,
            ),
        ),
    )

    failures = compare_retrogrades(chart, reference)

    assert len(failures) == 1
    assert "Saturn" in failures[0]


def test_missing_ascendant_is_reported_not_skipped(chart):
    """An unknown-time chart checked against a reference that has a Lagna."""
    unknown_birth = BirthData(
        birth_date=date(1990, 8, 15),
        time_confidence=BirthTimeConfidence.UNKNOWN,
        latitude=18.9756,
        longitude=72.8258,
        timezone_name="Asia/Kolkata",
    )
    unknown_chart = calculate_d1_chart(unknown_birth)
    reference = _reference(chart)

    failures = compare_ascendant(unknown_chart, reference)

    assert len(failures) == 1
    assert "no ascendant" in failures[0]


# --- Unchecked values must not be silently treated as passing ------------


@pytest.mark.parametrize(
    "comparison",
    [compare_nakshatras, compare_padas, compare_retrogrades],
)
def test_optional_fields_are_skipped_when_absent(chart, comparison):
    """Omitting a field means "not checked", not "checked and fine"."""
    reference = _reference(chart)  # records no nakshatra/pada/retrograde

    assert comparison(chart, reference) == []


# --- Fixture validation ---------------------------------------------------


def test_template_placeholder_source_is_rejected():
    """The shipped template must not be loadable as a real fixture."""
    with pytest.raises(ValidationError, match="source must name"):
        ReferenceChart(
            source="REPLACE ME - software name and version", birth=BIRTH
        )


def test_short_source_is_rejected():
    with pytest.raises(ValidationError, match="source must name"):
        ReferenceChart(source="JH", birth=BIRTH)


def test_bad_sign_name_in_a_fixture_fails_loudly():
    """A typo must surface as a fixture error, not a chart mismatch."""
    with pytest.raises(ValidationError):
        ReferencePosition(rashi="Vrischikaa", deg=20, min=43)


def test_out_of_range_degrees_are_rejected():
    with pytest.raises(ValidationError):
        ReferencePosition(rashi="Mesha", deg=30, min=0)


def test_zero_tolerance_is_rejected():
    """A zero tolerance would fail on floating-point noise alone."""
    with pytest.raises(ValidationError):
        ReferenceChart(source="Some Software 1.0", birth=BIRTH, tolerance_arcmin=0)


# --- Discovery ------------------------------------------------------------


def test_template_files_are_not_discovered(tmp_path):
    """Underscore-prefixed files are documentation, not data."""
    (tmp_path / "_template.json").write_text("{}")
    (tmp_path / "real_chart.json").write_text("{}")

    found = discover_references(tmp_path)

    assert [path.name for path in found] == ["real_chart.json"]


def test_shipped_template_is_ignored_by_discovery():
    from tests.test_reference_charts import REFERENCE_DIR, REFERENCE_FILES

    assert (REFERENCE_DIR / "_template.json").exists()
    assert (REFERENCE_DIR / "_template.json") not in REFERENCE_FILES


def test_a_written_fixture_round_trips(tmp_path, chart):
    """End-to-end: a fixture on disk loads and compares."""
    reference = _reference(chart)
    path = tmp_path / "round_trip.json"
    path.write_text(reference.model_dump_json(indent=2))

    loaded = load_reference(path)

    assert loaded.source == reference.source
    assert compare_longitudes(chart, loaded) == []
