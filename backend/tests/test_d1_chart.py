"""D1 / Rashi chart service."""

from __future__ import annotations

import pytest

from app.core.config import CalculationConfig, NodeType
from app.services.astrology.common.constants import (
    NAVAGRAHA,
    RASHI_LORDS,
    RASHIS,
)
from app.services.astrology.vedic.d1 import calculate_d1_chart


@pytest.fixture
def chart(reference_birth, config):
    return calculate_d1_chart(reference_birth, config)


@pytest.fixture
def unknown_chart(unknown_time_birth, config):
    return calculate_d1_chart(unknown_time_birth, config)


# --- Shape ----------------------------------------------------------------


def test_chart_identifies_its_system(chart):
    assert chart.system == "vedic"
    assert chart.zodiac == "sidereal"
    assert chart.chart_type == "D1"


def test_all_nine_grahas_are_placed(chart):
    assert tuple(p.graha for p in chart.placements) == NAVAGRAHA


def test_every_placement_is_internally_consistent(chart):
    """Derived fields must agree with the longitude they came from."""
    for placement in chart.placements:
        assert 0.0 <= placement.longitude < 360.0
        assert placement.rashi == RASHIS[placement.rashi_index]
        assert placement.rashi_index == int(placement.longitude // 30)
        assert placement.degrees_in_rashi == pytest.approx(
            placement.longitude % 30.0
        )
        assert 1 <= placement.nakshatra.pada <= 4
        assert placement.nakshatra.index == int(placement.longitude // (360 / 27))


# --- Ketu -----------------------------------------------------------------


def test_ketu_is_exactly_opposite_rahu(chart):
    rahu = chart.placement("Rahu")
    ketu = chart.placement("Ketu")

    separation = (ketu.longitude - rahu.longitude) % 360.0
    assert separation == pytest.approx(180.0, abs=1e-9)
    assert ketu.derived_from == "Rahu"


def test_ketu_is_six_bhavas_from_rahu(chart):
    rahu = chart.placement("Rahu")
    ketu = chart.placement("Ketu")

    assert (ketu.bhava - rahu.bhava) % 12 == 6


def test_nodes_are_always_retrograde(chart):
    """The mean node's motion is retrograde by definition."""
    assert chart.placement("Rahu").retrograde
    assert chart.placement("Ketu").retrograde


def test_true_node_configuration_is_honoured(reference_birth, config):
    mean = calculate_d1_chart(reference_birth, config)
    true = calculate_d1_chart(
        reference_birth, config.model_copy(update={"node_type": NodeType.TRUE})
    )

    assert mean.placement("Rahu").longitude != true.placement("Rahu").longitude


# --- Bhavas ---------------------------------------------------------------


def test_ascendant_is_the_first_bhava(chart):
    """Whole-sign: the Lagna rashi is the 1st bhava in its entirety."""
    assert chart.bhavas[0].rashi_index == chart.ascendant.rashi_index
    assert chart.bhavas[0].number == 1


def test_bhavas_run_twelve_consecutive_rashis(chart):
    assert len(chart.bhavas) == 12

    for offset, bhava in enumerate(chart.bhavas):
        expected = (chart.ascendant.rashi_index + offset) % 12
        assert bhava.number == offset + 1
        assert bhava.rashi_index == expected
        assert bhava.rashi == RASHIS[expected]
        assert bhava.lord == RASHI_LORDS[expected]


def test_bhava_assignment_follows_from_rashi(chart):
    """A graha's bhava must be derivable from its rashi and the Lagna."""
    ascendant_rashi = chart.ascendant.rashi_index

    for placement in chart.placements:
        expected = ((placement.rashi_index - ascendant_rashi) % 12) + 1
        assert placement.bhava == expected


def test_bhava_occupants_match_the_placements(chart):
    """The two views of the same fact must not disagree."""
    from_bhavas = {
        graha for bhava in chart.bhavas for graha in bhava.grahas
    }
    from_placements = {p.graha for p in chart.placements if p.bhava is not None}

    assert from_bhavas == from_placements

    for bhava in chart.bhavas:
        for graha in bhava.grahas:
            assert chart.placement(graha).bhava == bhava.number


def test_reference_ascendant_is_vrischika(chart):
    """Pins the reference chart's Lagna against the tropical-frame error."""
    assert chart.ascendant.rashi == "Vrischika"
    assert chart.ascendant.lord == "Mars"
    assert chart.ascendant.longitude == pytest.approx(230.7275, abs=1e-3)


# --- Unknown birth time ---------------------------------------------------


def test_unknown_time_withholds_the_ascendant(unknown_chart):
    """Spec §9: no fabricated Ascendant, no invented houses."""
    assert unknown_chart.ascendant is None
    assert unknown_chart.bhavas == ()


def test_unknown_time_names_what_is_missing(unknown_chart):
    """The gap must be stated so the UI and AI can report it (spec §29)."""
    assert "ascendant" in unknown_chart.metadata.unavailable
    assert "bhavas" in unknown_chart.metadata.unavailable


def test_unknown_time_still_places_the_grahas(unknown_chart):
    """Slow bodies remain meaningful even without a time."""
    assert len(unknown_chart.placements) == len(NAVAGRAHA)

    for placement in unknown_chart.placements:
        assert placement.bhava is None


def test_unknown_time_marks_the_moon_uncertain(unknown_chart):
    """The Moon covers ~13 degrees a day, so its rashi may be unanswerable."""
    moon = unknown_chart.placement("Moon")

    assert not moon.certainty.pada_certain
    assert not moon.certainty.nakshatra_certain


def test_unknown_time_keeps_slow_bodies_certain(unknown_chart):
    """Saturn moves ~2 arcmin a day; a day's uncertainty cannot move it."""
    saturn = unknown_chart.placement("Saturn")

    assert saturn.certainty.rashi_certain
    assert saturn.certainty.nakshatra_certain
    assert saturn.certainty.fully_certain


def test_exact_time_leaves_everything_certain(chart):
    for placement in chart.placements:
        assert placement.certainty.fully_certain, placement.graha


def test_moon_nakshatra_is_withheld_when_uncertain(unknown_chart):
    """The Dasha timeline seeds from this, so an unsafe value must not pass."""
    assert unknown_chart.moon_nakshatra is None
    assert "moon_nakshatra" in unknown_chart.metadata.unavailable


def test_moon_nakshatra_is_exposed_when_known(chart):
    assert chart.moon_nakshatra is not None
    assert chart.moon_nakshatra == chart.placement("Moon").nakshatra
    assert chart.moon_nakshatra.lord in {
        "Ketu", "Venus", "Sun", "Moon", "Mars",
        "Rahu", "Jupiter", "Saturn", "Mercury",
    }


# --- Reproducibility ------------------------------------------------------


def test_chart_is_deterministic(reference_birth, config):
    """Spec §10: identical inputs must reproduce identical output."""
    first = calculate_d1_chart(reference_birth, config)
    second = calculate_d1_chart(reference_birth, config)

    assert first.model_dump_json() == second.model_dump_json()


def test_metadata_records_everything_needed_to_reproduce(chart):
    metadata = chart.metadata

    assert metadata.engine_id
    assert metadata.calculation_version
    assert metadata.config == CalculationConfig()
    assert metadata.moment.timezone_name == "Asia/Kolkata"
    assert metadata.ayanamsa_degrees == pytest.approx(23.7, abs=0.5)


def test_ayanamsa_is_reported_but_already_applied(chart):
    """Sidereal longitudes must not need the reported ayanamsa subtracting."""
    sun = chart.placement("Sun")

    # The tropical Sun on this date is in Leo; sidereal Lahiri puts it in
    # Karka. Finding Leo here would mean the ayanamsa was never applied.
    assert sun.rashi == "Karka"
    assert chart.metadata.ayanamsa_degrees > 23.0
