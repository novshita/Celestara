"""Transit (Gochar) service.

Two areas get the most attention: the natal-relative arithmetic, and the
cache. The cache is the riskier of the two - a key that omitted the
calculation configuration would silently serve one user's settings to
another, and nothing in the output would look wrong.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

import pytest

from app.core.config import (
    DEFAULT_CALCULATION_CONFIG,
    Ayanamsa,
    CalculationConfig,
    NodeType,
)
from app.domain.birth_data import BirthData, BirthTimeConfidence
from app.services.astrology.common.constants import NAVAGRAHA
from app.services.astrology.common.swisseph_engine import SwissEphemerisEngine
from app.services.astrology.transit.service import (
    GRANULARITY_SECONDS,
    _quantise,
    build_snapshot,
    calculate_transits,
    clear_snapshot_cache,
    current_snapshot,
    relate_to_chart,
)
from app.services.astrology.vedic.d1 import calculate_d1_chart

MOMENT = datetime(2026, 9, 22, 12, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def _clean_cache():
    """Each test starts with an empty cache, so ordering cannot affect it."""
    clear_snapshot_cache()
    yield
    clear_snapshot_cache()


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


@pytest.fixture
def unknown_birth() -> BirthData:
    return BirthData(
        birth_date=date(1990, 8, 15),
        time_confidence=BirthTimeConfidence.UNKNOWN,
        latitude=18.9756,
        longitude=72.8258,
        timezone_name="Asia/Kolkata",
    )


# --- Quantisation ---------------------------------------------------------


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ((12, 0, 0), (12, 0, 0)),
        ((12, 0, 30), (12, 0, 0)),
        ((12, 0, 59), (12, 0, 0)),
        ((12, 59, 59), (12, 59, 0)),
        ((23, 59, 59), (23, 59, 0)),
        ((0, 0, 1), (0, 0, 0)),
    ],
)
def test_moments_are_floored_to_the_granularity(given, expected):
    quantised = _quantise(datetime(2026, 9, 22, *given, tzinfo=timezone.utc))

    assert (quantised.hour, quantised.minute, quantised.second) == expected
    assert quantised.microsecond == 0


def test_naive_moments_are_read_as_utc():
    assert _quantise(datetime(2026, 9, 22, 12, 0)).tzinfo == timezone.utc


def test_non_utc_moments_are_converted_not_truncated():
    """A +05:30 moment must become the same instant in UTC."""
    ist = timezone(timedelta(hours=5, minutes=30))

    quantised = _quantise(datetime(2026, 9, 22, 17, 30, tzinfo=ist))

    assert quantised.hour == 12
    assert quantised.minute == 0


def test_snapshot_reports_the_quantised_moment(engine, config):
    """The timestamp must describe the positions actually calculated."""
    snapshot = build_snapshot(
        datetime(2026, 9, 22, 12, 0, 45, tzinfo=timezone.utc), config, engine
    )

    assert snapshot.moment.second == 0
    assert snapshot.granularity_seconds == GRANULARITY_SECONDS


def test_granularity_costs_less_than_an_arcminute(engine, config):
    """The Moon is the fastest body; a minute of rounding must not matter.

    If this ever exceeds an arcminute the granularity is too coarse, since
    that approaches the precision reference charts are compared at.
    """
    first = build_snapshot(MOMENT, config, engine).position("Moon").longitude
    later = build_snapshot(
        MOMENT + timedelta(seconds=GRANULARITY_SECONDS), config, engine
    ).position("Moon").longitude

    assert abs(later - first) * 60 < 1.0


# --- Snapshot content -----------------------------------------------------


def test_snapshot_covers_the_full_navagraha(engine, config):
    snapshot = build_snapshot(MOMENT, config, engine)

    assert tuple(p.graha for p in snapshot.positions) == NAVAGRAHA


def test_snapshot_positions_are_internally_consistent(engine, config):
    for position in build_snapshot(MOMENT, config, engine).positions:
        assert 0.0 <= position.longitude < 360.0
        assert position.rashi_index == int(position.longitude // 30)
        assert position.degrees_in_rashi == pytest.approx(
            position.longitude % 30.0
        )
        assert 1 <= position.nakshatra.pada <= 4


def test_snapshot_ketu_is_opposite_rahu(engine, config):
    snapshot = build_snapshot(MOMENT, config, engine)

    separation = (
        snapshot.position("Ketu").longitude - snapshot.position("Rahu").longitude
    ) % 360.0
    assert separation == pytest.approx(180.0, abs=1e-9)
    assert snapshot.position("Ketu").derived_from == "Rahu"


def test_snapshot_records_what_produced_it(engine, config):
    snapshot = build_snapshot(MOMENT, config, engine)

    assert "swisseph" in snapshot.engine_id
    assert snapshot.calculation_version
    assert snapshot.config == config


def test_snapshot_is_deterministic(engine, config):
    first = build_snapshot(MOMENT, config, engine)
    second = build_snapshot(MOMENT, config, engine)

    assert first.model_dump_json() == second.model_dump_json()


def test_snapshot_carries_no_personal_data(engine, config):
    """What makes a snapshot safe to share across users.

    Checks for the sensitive *values* rather than field names, since a graha
    has its own longitude and that is not personal. If any birth detail ever
    reached a snapshot, the cache below would leak it between users.
    """
    serialised = build_snapshot(MOMENT, config, engine).model_dump_json()

    for personal in ("18.9756", "72.8258", "Asia/Kolkata", "1990-08-15"):
        assert personal not in serialised

    payload = build_snapshot(MOMENT, config, engine).model_dump()
    assert "birth" not in payload
    assert "moment" in payload


# --- Cache ---------------------------------------------------------------


def test_repeated_requests_within_the_granularity_are_shared():
    """Two requests a few seconds apart must hit the same cache entry."""
    first = current_snapshot(datetime(2026, 9, 22, 12, 0, 5, tzinfo=timezone.utc))
    second = current_snapshot(
        datetime(2026, 9, 22, 12, 0, 55, tzinfo=timezone.utc)
    )

    assert first is second


def test_different_minutes_are_not_shared():
    first = current_snapshot(datetime(2026, 9, 22, 12, 0, tzinfo=timezone.utc))
    second = current_snapshot(datetime(2026, 9, 22, 12, 1, tzinfo=timezone.utc))

    assert first is not second
    assert first.moment != second.moment


def test_cache_key_includes_the_node_type():
    """Different settings must never share an entry.

    A key of moment alone would serve mean-node positions to a caller who
    asked for true nodes, with nothing in the response to reveal it.
    """
    mean = current_snapshot(
        MOMENT, DEFAULT_CALCULATION_CONFIG.model_copy(
            update={"node_type": NodeType.MEAN}
        )
    )
    true = current_snapshot(
        MOMENT, DEFAULT_CALCULATION_CONFIG.model_copy(
            update={"node_type": NodeType.TRUE}
        )
    )

    assert mean is not true
    assert mean.position("Rahu").longitude != true.position("Rahu").longitude


def test_cached_snapshot_reports_the_config_it_used():
    snapshot = current_snapshot(
        MOMENT,
        DEFAULT_CALCULATION_CONFIG.model_copy(update={"node_type": NodeType.TRUE}),
    )

    assert snapshot.config.node_type is NodeType.TRUE


def test_explicit_engine_bypasses_the_cache(engine, config):
    """Injecting an engine must not poison or read the shared cache."""
    direct = current_snapshot(MOMENT, config, engine)
    cached = current_snapshot(MOMENT, config)

    assert direct is not cached
    assert direct.model_dump_json() == cached.model_dump_json()


def test_clearing_the_cache_forces_recalculation():
    first = current_snapshot(MOMENT)
    clear_snapshot_cache()
    second = current_snapshot(MOMENT)

    assert first is not second
    assert first.model_dump_json() == second.model_dump_json()


# --- Natal relationships -------------------------------------------------


@pytest.fixture
def report(exact_birth):
    return calculate_transits(exact_birth, at=MOMENT)


def test_report_covers_every_graha(report):
    assert tuple(t.graha for t in report.transits) == NAVAGRAHA


def test_bhava_from_ascendant_follows_the_whole_sign_count(report, exact_birth):
    chart = calculate_d1_chart(exact_birth)
    ascendant_rashi = chart.ascendant.rashi_index

    for transit in report.transits:
        expected = ((transit.transit.rashi_index - ascendant_rashi) % 12) + 1
        assert transit.bhava_from_ascendant == expected


def test_bhava_from_moon_uses_the_natal_moon_rashi(report, exact_birth):
    """Chandra Lagna, the traditional Gochar reference."""
    chart = calculate_d1_chart(exact_birth)
    moon_rashi = chart.placement("Moon").rashi_index

    for transit in report.transits:
        expected = ((transit.transit.rashi_index - moon_rashi) % 12) + 1
        assert transit.bhava_from_moon == expected


def test_the_two_references_differ_when_lagna_and_moon_differ(report):
    """Otherwise one of them is being computed from the wrong reference."""
    assert report.natal_ascendant_rashi != report.natal_moon_rashi

    differences = [
        t for t in report.transits
        if t.bhava_from_ascendant != t.bhava_from_moon
    ]
    assert len(differences) == len(report.transits)


def test_in_natal_rashi_matches_the_rashi_comparison(report, exact_birth):
    chart = calculate_d1_chart(exact_birth)

    for transit in report.transits:
        natal_rashi = chart.placement(transit.graha).rashi_index
        assert transit.in_natal_rashi == (
            transit.transit.rashi_index == natal_rashi
        )


def test_separation_is_never_more_than_half_a_circle(report):
    for transit in report.transits:
        assert 0.0 <= transit.separation_from_natal <= 180.0


def test_separation_is_zero_at_birth(exact_birth):
    """Transits at the birth moment must sit on the natal positions."""
    chart = calculate_d1_chart(exact_birth)
    birth_moment = chart.metadata.moment.utc_datetime

    report = calculate_transits(exact_birth, at=birth_moment)

    for transit in report.transits:
        assert transit.separation_from_natal == pytest.approx(0.0, abs=0.01)
        assert transit.in_natal_rashi is True


def test_returning_graha_is_flagged(report):
    """A graha back in its natal rashi is flagged and sits within 30 degrees."""
    for transit in report.transits:
        if transit.in_natal_rashi:
            assert transit.separation_from_natal < 30.0


def test_report_names_its_reference_points(report):
    assert report.natal_ascendant_rashi == "Vrischika"
    assert report.natal_moon_rashi == "Vrishabha"
    assert report.unavailable == ()


# --- Unknown birth time --------------------------------------------------


def test_unknown_birth_time_still_gives_exact_transits(unknown_birth):
    """Transiting positions depend on now, not on the birth."""
    report = calculate_transits(unknown_birth, at=MOMENT)
    reference = current_snapshot(MOMENT)

    for graha in NAVAGRAHA:
        assert report.snapshot.position(graha).longitude == pytest.approx(
            reference.position(graha).longitude
        )


def test_unknown_birth_time_withholds_the_ascendant_reference(unknown_birth):
    report = calculate_transits(unknown_birth, at=MOMENT)

    assert report.natal_ascendant_rashi is None
    assert "bhava_from_ascendant" in report.unavailable
    assert all(t.bhava_from_ascendant is None for t in report.transits)


def test_unknown_birth_time_can_still_give_the_moon_reference(unknown_birth):
    """An unknown birth time does not automatically lose the Moon's rashi.

    The Moon travels about 6.6 degrees either side of noon, so whether its
    *rashi* survives depends on where in the sign it falls. On this date it
    sits at Vrishabha 19.8, comfortably inside - so Chandra Lagna is usable
    even though the nakshatra is not. Withholding it here would discard
    information we genuinely have.
    """
    report = calculate_transits(unknown_birth, at=MOMENT)

    assert report.natal_moon_rashi == "Vrishabha"
    assert "bhava_from_moon" not in report.unavailable
    assert all(t.bhava_from_moon is not None for t in report.transits)


def test_moon_reference_is_withheld_near_a_rashi_boundary():
    """When the Moon's rashi really is uncertain, Chandra Lagna is withheld.

    On 1990-08-02 the Moon sits at Vrischika 26.4, within 3.6 degrees of the
    next sign, so a 24-hour window straddles the boundary and the rashi cannot
    be stated.
    """
    birth = BirthData(
        birth_date=date(1990, 8, 2),
        time_confidence=BirthTimeConfidence.UNKNOWN,
        latitude=18.9756,
        longitude=72.8258,
        timezone_name="Asia/Kolkata",
    )

    report = calculate_transits(birth, at=MOMENT)

    assert report.natal_moon_rashi is None
    assert "bhava_from_moon" in report.unavailable
    assert all(t.bhava_from_moon is None for t in report.transits)


def test_unknown_birth_time_keeps_slow_body_comparisons(unknown_birth):
    """Saturn's natal rashi is certain even without a birth time."""
    report = calculate_transits(unknown_birth, at=MOMENT)
    saturn = report.transit_of("Saturn")

    assert saturn.natal_rashi
    assert saturn.separation_from_natal >= 0.0


def test_references_can_be_unavailable_independently(exact_birth):
    """The two reference points have different requirements.

    Constructed directly rather than through a birth record, because no single
    birth input produces an Ascendant without a certain Moon.
    """
    chart = calculate_d1_chart(exact_birth)
    snapshot = current_snapshot(MOMENT)

    moonless = chart.model_copy(
        update={
            "placements": tuple(
                p.model_copy(
                    update={
                        "certainty": p.certainty.model_copy(
                            update={"rashi_certain": False}
                        )
                    }
                )
                if p.graha == "Moon"
                else p
                for p in chart.placements
            )
        }
    )

    report = relate_to_chart(snapshot, moonless)

    assert report.natal_ascendant_rashi is not None
    assert report.natal_moon_rashi is None
    assert report.unavailable == ("bhava_from_moon",)
    assert all(t.bhava_from_ascendant is not None for t in report.transits)


# --- Configuration -------------------------------------------------------


def test_unsupported_ayanamsa_is_rejected_before_calculating():
    """A bad config must fail rather than silently use the default."""
    from app.services.astrology.common.ephemeris import EphemerisError

    broken = CalculationConfig().model_copy(update={"ayanamsa": "fictional"})

    with pytest.raises(EphemerisError, match="unsupported ayanamsa"):
        SwissEphemerisEngine(broken)


def test_ayanamsa_is_recorded_in_the_snapshot(engine, config):
    snapshot = build_snapshot(MOMENT, config, engine)

    assert snapshot.config.ayanamsa is Ayanamsa.LAHIRI
    assert Ayanamsa.LAHIRI.value in snapshot.engine_id
