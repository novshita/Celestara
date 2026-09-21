"""Validation against externally-sourced reference charts.

Engineering spec §5 requires unit tests against known reference charts. The
rest of the suite proves the calculation layer is *self-consistent* - but the
values it pins were read off the same engine that produces them, so a
systematic misconfiguration (wrong ayanamsa, wrong frame, wrong node type)
would pass every one of them.

These tests close that loop by comparing our output to charts produced by
independent software. Adding a fixture is a manual step by design: the
expected values must come from somewhere other than our own engine, or the
reasoning is circular again.

See `reference_charts/README.md` for how to add one. The comparison logic
lives in `reference_support.py` and is itself tested by
`test_reference_harness.py`.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services.astrology.vedic.d1 import calculate_d1_chart
from tests.reference_support import (
    ReferenceChart,
    compare_ascendant,
    compare_ascendant_rashi,
    compare_longitudes,
    compare_nakshatras,
    compare_padas,
    compare_retrogrades,
    compare_rashis,
    discover_references,
    load_reference,
)

REFERENCE_DIR = Path(__file__).parent / "reference_charts"
REFERENCE_FILES = discover_references(REFERENCE_DIR)

_NO_FIXTURES = (
    "No external reference charts have been added yet, so calculation "
    "accuracy is self-consistent but externally unverified. See "
    "tests/reference_charts/README.md to add one."
)

if REFERENCE_FILES:
    _PARAMS = [pytest.param(path, id=path.stem) for path in REFERENCE_FILES]
else:
    _PARAMS = [pytest.param(None, id="none-added-yet")]


@pytest.fixture(params=_PARAMS)
def reference(request) -> ReferenceChart:
    if request.param is None:
        pytest.skip(_NO_FIXTURES)
    return load_reference(request.param)


@pytest.fixture
def chart(reference: ReferenceChart):
    """Our output for the reference's birth data, at default configuration."""
    return calculate_d1_chart(reference.birth)


def _assert_no_failures(failures: list[str], heading: str) -> None:
    assert not failures, heading + "\n" + "\n".join(failures)


# --- Comparisons ----------------------------------------------------------


def test_ascendant_matches_reference(chart, reference):
    _assert_no_failures(compare_ascendant(chart, reference), "")


def test_ascendant_rashi_matches_reference(chart, reference):
    _assert_no_failures(compare_ascendant_rashi(chart, reference), "")


def test_graha_longitudes_match_reference(chart, reference):
    failures = compare_longitudes(chart, reference)
    _assert_no_failures(
        failures,
        f"{len(failures)} graha disagree with {reference.source} "
        f"(tolerance {reference.tolerance_arcmin} arcmin):",
    )


def test_graha_rashis_match_reference(chart, reference):
    _assert_no_failures(
        compare_rashis(chart, reference),
        f"graha in the wrong rashi per {reference.source}:",
    )


def test_nakshatras_match_reference(chart, reference):
    _assert_no_failures(
        compare_nakshatras(chart, reference),
        f"nakshatra mismatches against {reference.source}:",
    )


def test_padas_match_reference(chart, reference):
    _assert_no_failures(
        compare_padas(chart, reference),
        f"pada mismatches against {reference.source}:",
    )


def test_retrogrades_match_reference(chart, reference):
    _assert_no_failures(
        compare_retrogrades(chart, reference),
        f"retrograde mismatches against {reference.source}:",
    )


# --- Fixture hygiene ------------------------------------------------------


def test_reference_verifies_something(reference: ReferenceChart):
    """A fixture with neither an ascendant nor placements checks nothing."""
    assert reference.verifies_something(), (
        f"{reference.source} records no ascendant and no placements"
    )


def test_reference_covers_the_full_navagraha(reference: ReferenceChart):
    """Partial fixtures are allowed but worth surfacing.

    Transcribing all nine is only a little more work than transcribing four,
    and a missing body is a body nobody is checking.
    """
    from app.services.astrology.common.constants import NAVAGRAHA

    if not reference.placements:
        pytest.skip("this reference records no placements")

    recorded = {placement.graha for placement in reference.placements}
    missing = [graha for graha in NAVAGRAHA if graha not in recorded]

    assert not missing, (
        f"{reference.source} does not record {', '.join(missing)}; "
        f"those positions are unverified"
    )
