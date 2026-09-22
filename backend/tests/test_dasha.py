"""Vimshottari Dasha timeline.

The timeline is the most birth-time-sensitive output in the application: the
Moon's position inside its nakshatra decides both which lord rules first and
how much of that period was already spent. Getting either wrong shifts every
date in a 120-year sequence, so the arithmetic is pinned closely here.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

import pytest

from app.core.config import (
    DASHA_YEAR_DAYS,
    DEFAULT_CALCULATION_CONFIG,
    CalculationConfig,
    DashaYearLength,
)
from app.domain.birth_data import (
    BirthData,
    BirthTimeConfidence,
    DstAnomaly,
    ResolvedBirthMoment,
)
from app.domain.dasha import DashaLevel
from app.services.astrology.common.constants import (
    DEGREES_PER_NAKSHATRA,
    NAKSHATRA_LORD_CYCLE,
    VIMSHOTTARI_PERIOD_YEARS,
    VIMSHOTTARI_TOTAL_YEARS,
)
from app.services.astrology.vedic.dasha import (
    DashaUnavailableError,
    _order_from,
    build_timeline,
    calculate_vimshottari,
)

BIRTH_UTC = datetime(1990, 8, 15, 9, 0, tzinfo=timezone.utc)


def _moment(
    confidence: BirthTimeConfidence = BirthTimeConfidence.EXACT,
    uncertainty_hours: float = 0.0,
) -> ResolvedBirthMoment:
    """A minimal resolved moment, so timeline maths needs no ephemeris."""
    return ResolvedBirthMoment(
        utc_datetime=BIRTH_UTC,
        julian_day_ut=2448118.875,
        timezone_name="Asia/Kolkata",
        utc_offset_hours=5.5,
        time_confidence=confidence,
        dst_anomaly=DstAnomaly.NONE,
        uncertainty_hours=uncertainty_hours,
    )


def _longitude_in(nakshatra_index: int, fraction: float) -> float:
    """A longitude `fraction` of the way through a given nakshatra."""
    return (nakshatra_index + fraction) * DEGREES_PER_NAKSHATRA


# --- The period table -----------------------------------------------------


def test_periods_sum_to_one_hundred_twenty():
    """Definitional: "Vimshottari" means "of 120"."""
    assert sum(VIMSHOTTARI_PERIOD_YEARS.values()) == VIMSHOTTARI_TOTAL_YEARS == 120


def test_every_lord_has_a_period():
    assert set(VIMSHOTTARI_PERIOD_YEARS) == set(NAKSHATRA_LORD_CYCLE)


@pytest.mark.parametrize(
    ("lord", "years"),
    [
        ("Ketu", 7), ("Venus", 20), ("Sun", 6), ("Moon", 10), ("Mars", 7),
        ("Rahu", 18), ("Jupiter", 16), ("Saturn", 19), ("Mercury", 17),
    ],
)
def test_individual_period_lengths(lord, years):
    """Pinned individually: a transposition would still sum to 120."""
    assert VIMSHOTTARI_PERIOD_YEARS[lord] == years


def test_order_rotates_without_losing_or_repeating_a_lord():
    for lord in NAKSHATRA_LORD_CYCLE:
        order = _order_from(lord)

        assert order[0] == lord
        assert len(order) == 9
        assert set(order) == set(NAKSHATRA_LORD_CYCLE)


def test_order_preserves_the_cycle_sequence():
    """Rotation must not reverse or reshuffle the sequence."""
    assert _order_from("Moon") == (
        "Moon", "Mars", "Rahu", "Jupiter", "Saturn",
        "Mercury", "Ketu", "Venus", "Sun",
    )


# --- Seeding from the Moon ------------------------------------------------


def test_starting_lord_is_the_moon_nakshatra_lord():
    for index in range(27):
        timeline = build_timeline(_longitude_in(index, 0.5), _moment())

        assert timeline.starting_lord == timeline.moon_nakshatra.lord
        assert timeline.periods[0].lord == timeline.starting_lord


def test_moon_at_nakshatra_start_gives_a_full_first_period():
    """Nothing has elapsed, so the first Mahadasha is its full length."""
    timeline = build_timeline(_longitude_in(3, 0.0), _moment())  # Rohini, lord Moon

    assert timeline.elapsed_fraction == pytest.approx(0.0)
    assert timeline.balance_years == pytest.approx(10.0)
    assert timeline.periods[0].is_partial is False


def test_moon_at_nakshatra_end_gives_almost_no_first_period():
    timeline = build_timeline(_longitude_in(3, 0.999999), _moment())

    assert timeline.elapsed_fraction == pytest.approx(1.0, abs=1e-5)
    assert timeline.balance_years == pytest.approx(0.0, abs=1e-4)


def test_balance_is_the_unelapsed_share_of_the_period():
    """Quarter of the way through Rohini leaves three quarters of 10 years."""
    timeline = build_timeline(_longitude_in(3, 0.25), _moment())

    assert timeline.balance_years == pytest.approx(7.5)


def test_elapsed_fraction_never_escapes_zero_to_one():
    for index in range(27):
        for fraction in (0.0, 0.001, 0.5, 0.999, 1.0):
            timeline = build_timeline(_longitude_in(index, fraction), _moment())
            assert 0.0 <= timeline.elapsed_fraction <= 1.0


# --- Mahadasha structure --------------------------------------------------


@pytest.fixture
def timeline():
    """Rohini, 25% elapsed: first lord Moon with 7.5 years remaining."""
    return build_timeline(_longitude_in(3, 0.25), _moment())


def test_one_cycle_produces_nine_mahadashas(timeline):
    assert len(timeline.periods) == 9
    assert all(p.level is DashaLevel.MAHA for p in timeline.periods)


def test_mahadashas_follow_the_rotated_order(timeline):
    assert tuple(p.lord for p in timeline.periods) == _order_from("Moon")


def test_only_the_first_mahadasha_is_partial(timeline):
    assert timeline.periods[0].is_partial is True
    assert all(not p.is_partial for p in timeline.periods[1:])


def test_timeline_starts_at_birth(timeline):
    assert timeline.periods[0].start == BIRTH_UTC


def test_mahadashas_are_contiguous(timeline):
    """No gaps and no overlaps: one period ends exactly where the next begins."""
    for earlier, later in zip(timeline.periods, timeline.periods[1:]):
        assert earlier.end == later.start


def test_later_mahadashas_are_their_full_length(timeline):
    for period in timeline.periods[1:]:
        expected = float(VIMSHOTTARI_PERIOD_YEARS[period.lord])
        assert period.duration_years == pytest.approx(expected, abs=1e-6)


def test_first_mahadasha_duration_is_the_balance(timeline):
    assert timeline.periods[0].duration_years == pytest.approx(
        timeline.balance_years, abs=1e-6
    )


def test_total_span_is_one_hundred_twenty_less_what_elapsed(timeline):
    """The cycle is 120 years, minus the part spent before birth."""
    elapsed = 10.0 * timeline.elapsed_fraction
    span_years = (timeline.end - timeline.start).total_seconds() / (
        timeline.year_days * 86400.0
    )

    assert span_years == pytest.approx(
        VIMSHOTTARI_TOTAL_YEARS - elapsed, abs=1e-6
    )


def test_two_cycles_produce_eighteen_mahadashas():
    config = DEFAULT_CALCULATION_CONFIG.model_copy(update={"dasha_cycles": 2})

    timeline = build_timeline(_longitude_in(3, 0.25), _moment(), config)

    assert len(timeline.periods) == 18
    assert timeline.periods[9].lord == timeline.periods[0].lord
    assert timeline.periods[9].is_partial is False


# --- Sub-period structure -------------------------------------------------


def test_antardashas_start_from_their_own_mahadasha_lord(timeline):
    """A full Mahadasha's first Antardasha is ruled by the same lord."""
    for period in timeline.periods[1:]:
        assert period.sub_periods[0].lord == period.lord
        assert tuple(s.lord for s in period.sub_periods) == _order_from(period.lord)


def test_antardashas_sum_to_their_parent(timeline):
    for period in timeline.periods:
        total = sum(s.duration_years for s in period.sub_periods)
        assert total == pytest.approx(period.duration_years, abs=1e-6)


def test_antardashas_span_exactly_their_parent(timeline):
    for period in timeline.periods:
        assert period.sub_periods[0].start == period.start
        assert period.sub_periods[-1].end == period.end


def test_antardashas_are_contiguous(timeline):
    for period in timeline.periods:
        for earlier, later in zip(period.sub_periods, period.sub_periods[1:]):
            assert earlier.end == later.start


def test_antardasha_length_is_proportional_to_its_lords_period(timeline):
    """A lord's share of a Mahadasha is its own period over 120."""
    mars = next(p for p in timeline.periods if p.lord == "Mars")

    for sub in mars.sub_periods:
        expected = 7.0 * VIMSHOTTARI_PERIOD_YEARS[sub.lord] / 120.0
        assert sub.duration_years == pytest.approx(expected, abs=1e-6)


def test_elapsed_antardashas_are_dropped_from_a_partial_mahadasha():
    """Sub-periods that finished before birth must not appear.

    The first Mahadasha is truncated, so its sub-periods have to be laid out
    across the *full* period and then clipped. Compressing nine sub-periods
    into the remaining time instead would be the easy mistake, and would shift
    every sub-boundary while still summing correctly.
    """
    # 84.8% through Rohini: 8.48 of the Moon's 10 years already spent.
    timeline = build_timeline(_longitude_in(3, 0.848), _moment())
    first = timeline.periods[0]

    assert len(first.sub_periods) < 9
    assert first.sub_periods[0].is_partial is True
    # Cumulative Antardashas of a Moon Mahadasha put 8.48 years inside Venus.
    assert first.sub_periods[0].lord == "Venus"
    assert first.sub_periods[-1].lord == "Sun"


def test_no_period_begins_before_birth(timeline):
    """Nothing before the birth moment may surface at any level."""

    def walk(periods):
        for period in periods:
            assert period.start >= BIRTH_UTC
            walk(period.sub_periods)

    walk(timeline.periods)


def test_level_depth_follows_configuration():
    for levels, deepest in (
        (1, DashaLevel.MAHA),
        (2, DashaLevel.ANTAR),
        (3, DashaLevel.PRATYANTAR),
    ):
        config = DEFAULT_CALCULATION_CONFIG.model_copy(
            update={"dasha_levels": levels}
        )
        timeline = build_timeline(_longitude_in(3, 0.25), _moment(), config)

        period = timeline.periods[-1]
        depth = 1
        while period.sub_periods:
            period = period.sub_periods[0]
            depth += 1

        assert depth == levels
        assert period.level is deepest


def test_single_level_has_no_sub_periods():
    config = DEFAULT_CALCULATION_CONFIG.model_copy(update={"dasha_levels": 1})

    timeline = build_timeline(_longitude_in(3, 0.25), _moment(), config)

    assert all(p.sub_periods == () for p in timeline.periods)


# --- Year length ----------------------------------------------------------


@pytest.mark.parametrize("length", list(DashaYearLength))
def test_year_length_is_recorded(length):
    config = DEFAULT_CALCULATION_CONFIG.model_copy(
        update={"dasha_year_length": length}
    )

    timeline = build_timeline(_longitude_in(3, 0.25), _moment(), config)

    assert timeline.year_length is length
    assert timeline.year_days == DASHA_YEAR_DAYS[length]


def test_savana_year_shortens_the_timeline_measurably():
    """360-day years compress the cycle by about 1.7 calendar years.

    A 117.5-year span loses 5.25 days per year, so roughly 617 days. Pinned
    because it shows the setting is not cosmetic: the same birth data under a
    different tradition lands period boundaries in different calendar years,
    which is why the choice is explicit config and recorded in the output.
    """
    julian = build_timeline(
        _longitude_in(3, 0.25),
        _moment(),
        DEFAULT_CALCULATION_CONFIG.model_copy(
            update={"dasha_year_length": DashaYearLength.JULIAN}
        ),
    )
    savana = build_timeline(
        _longitude_in(3, 0.25),
        _moment(),
        DEFAULT_CALCULATION_CONFIG.model_copy(
            update={"dasha_year_length": DashaYearLength.SAVANA}
        ),
    )

    difference = julian.end - savana.end
    span_years = 120.0 - 10.0 * julian.elapsed_fraction
    expected = timedelta(days=span_years * (365.25 - 360.0))

    assert difference == pytest.approx(expected, abs=timedelta(days=1))
    assert difference > timedelta(days=500)


# --- Looking up the active period ----------------------------------------


def test_active_period_returns_the_full_lineage(timeline):
    lineage = timeline.active_at(datetime(2026, 9, 22, tzinfo=timezone.utc))

    assert len(lineage) == 2
    assert lineage[0].level is DashaLevel.MAHA
    assert lineage[1].level is DashaLevel.ANTAR
    assert lineage[1].start >= lineage[0].start
    assert lineage[1].end <= lineage[0].end


def test_active_period_at_birth_is_the_first_period(timeline):
    lineage = timeline.active_at(BIRTH_UTC)

    assert lineage[0] is timeline.periods[0]


def test_nothing_is_active_before_birth(timeline):
    assert timeline.active_at(BIRTH_UTC - timedelta(days=1)) == ()


def test_nothing_is_active_after_the_cycle(timeline):
    assert timeline.active_at(timeline.end + timedelta(days=1)) == ()


def test_period_end_is_exclusive(timeline):
    """Adjacent periods must not both claim the boundary instant."""
    boundary = timeline.periods[0].end

    assert not timeline.periods[0].contains(boundary)
    assert timeline.periods[1].contains(boundary)


def test_every_instant_in_the_span_has_exactly_one_mahadasha(timeline):
    """Sampled across the whole timeline, coverage is complete and unique."""
    span = timeline.end - timeline.start

    for step in range(200):
        moment = timeline.start + span * (step / 200.0)
        matches = [p for p in timeline.periods if p.contains(moment)]
        assert len(matches) == 1, f"{len(matches)} mahadashas claim {moment}"


# --- Integration with the chart ------------------------------------------


@pytest.fixture
def exact_birth() -> BirthData:
    return BirthData(
        birth_date=date(1990, 8, 15),
        birth_time=time(14, 30),
        time_confidence=BirthTimeConfidence.EXACT,
        latitude=18.9756,
        longitude=72.8258,
        timezone_name="Asia/Kolkata",
    )


def test_timeline_from_real_birth_data(exact_birth):
    timeline = calculate_vimshottari(exact_birth)

    assert timeline.moon_nakshatra.name == "Rohini"
    assert timeline.starting_lord == "Moon"
    assert timeline.periods[0].start == timeline.moment.utc_datetime


def test_exact_birth_time_has_no_boundary_uncertainty(exact_birth):
    assert calculate_vimshottari(exact_birth).uncertainty_days == 0.0


def test_estimated_birth_time_produces_boundary_uncertainty(exact_birth):
    """An hour of doubt moves period boundaries by roughly five months.

    The leverage here is much larger than it first looks, and is the reason
    this figure is reported at all. A lord's whole period is mapped onto a
    single 13°20' nakshatra, so for the Moon's 10 years each degree of Moon
    position is worth about 9 months of Dasha timing. The Moon covers ~14.26°
    a day, so a two-hour window spans ~1.19° - about 8.9% of the nakshatra,
    or 0.89 years of spread, giving a half-width near 163 days.

    Under a 20-year lord like Venus the same hour of doubt would be worth
    twice as much.
    """
    estimated = exact_birth.model_copy(
        update={"time_confidence": BirthTimeConfidence.ESTIMATED}
    )

    timeline = calculate_vimshottari(estimated)

    assert 120.0 < timeline.uncertainty_days < 220.0


def test_unknown_birth_time_refuses_to_produce_a_timeline():
    """A different nakshatra means a different lord and a different sequence.

    There is no approximate answer worth giving, so this raises rather than
    guessing (product spec §8).
    """
    unknown = BirthData(
        birth_date=date(1990, 8, 15),
        time_confidence=BirthTimeConfidence.UNKNOWN,
        latitude=18.9756,
        longitude=72.8258,
        timezone_name="Asia/Kolkata",
    )

    with pytest.raises(DashaUnavailableError, match="nakshatra"):
        calculate_vimshottari(unknown)


def test_timeline_is_deterministic(exact_birth):
    first = calculate_vimshottari(exact_birth)
    second = calculate_vimshottari(exact_birth)

    assert first.model_dump_json() == second.model_dump_json()


def test_timeline_records_its_configuration(exact_birth):
    """Reproducibility: the settings that produced this must travel with it."""
    timeline = calculate_vimshottari(exact_birth)

    assert timeline.config == CalculationConfig()
    assert timeline.moment.timezone_name == "Asia/Kolkata"
