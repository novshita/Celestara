"""Western natal chart.

The test that matters most is the first one: Western and Vedic must disagree by
exactly the ayanamsa. If they ever agree, the frames have been crossed - and
that is the defect this project hit on its very first branch.
"""

from __future__ import annotations

from datetime import date, time

import pytest

from app.core.config import (
    DEFAULT_CALCULATION_CONFIG,
    HouseSystem,
)
from app.domain.birth_data import BirthData, BirthTimeConfidence
from app.services.astrology.common.swisseph_engine import SwissEphemerisEngine
from app.services.astrology.vedic.d1 import calculate_d1_chart
from app.services.astrology.western.chart import calculate_western_chart
from app.services.astrology.western.constants import (
    CLASSICAL_BODIES,
    OUTER_BODIES,
    SIGNS,
    sign_index,
)


@pytest.fixture
def western(reference_birth, config):
    return calculate_western_chart(reference_birth, config)


@pytest.fixture
def unknown_western(unknown_time_birth, config):
    return calculate_western_chart(unknown_time_birth, config)


# --- Frame separation -----------------------------------------------------


def test_tropical_and_sidereal_differ_by_the_ayanamsa(reference_birth, config):
    """The two systems must disagree by exactly the ayanamsa, body by body.

    This is the guard against the frames being crossed. Agreement would mean
    one service is reading the other's zodiac; a difference other than the
    ayanamsa would mean something subtler is wrong.
    """
    vedic = calculate_d1_chart(reference_birth, config)
    western = calculate_western_chart(reference_birth, config)
    ayanamsa = vedic.metadata.ayanamsa_degrees

    for body in CLASSICAL_BODIES:
        tropical = western.position(body).longitude
        sidereal = vedic.placement(body).longitude

        difference = (tropical - sidereal) % 360.0
        assert difference == pytest.approx(ayanamsa, abs=1e-6), body


def test_tropical_and_sidereal_ascendants_differ_by_the_ayanamsa(
    reference_birth, config
):
    vedic = calculate_d1_chart(reference_birth, config)
    western = calculate_western_chart(reference_birth, config)

    difference = (
        western.angles.ascendant - vedic.ascendant.longitude
    ) % 360.0
    assert difference == pytest.approx(
        vedic.metadata.ayanamsa_degrees, abs=1e-3
    )


def test_the_two_systems_disagree_about_the_sun_sign(reference_birth, config):
    """The headline difference a user will notice, and want Compare to explain."""
    vedic = calculate_d1_chart(reference_birth, config)
    western = calculate_western_chart(reference_birth, config)

    assert western.position("Sun").sign == "Leo"
    assert vedic.placement("Sun").rashi == "Karka"


def test_western_chart_declares_its_zodiac(western):
    assert western.system == "western"
    assert western.zodiac == "tropical"


# --- Positions ------------------------------------------------------------


def test_classical_bodies_are_always_present(western):
    bodies = tuple(p.body for p in western.positions)

    for body in CLASSICAL_BODIES:
        assert body in bodies


def test_outer_planets_are_included_by_default(western):
    bodies = tuple(p.body for p in western.positions)

    for body in OUTER_BODIES:
        assert body in bodies


def test_outer_planets_can_be_excluded(reference_birth, config):
    """Absent from classical Western astrology, so some users want them off."""
    chart = calculate_western_chart(
        reference_birth, config.model_copy(update={"include_outer_planets": False})
    )

    bodies = tuple(p.body for p in chart.positions)
    assert bodies == CLASSICAL_BODIES
    assert chart.metadata.bodies_included == CLASSICAL_BODIES


def test_excluding_outer_planets_also_excludes_their_aspects(
    reference_birth, config
):
    chart = calculate_western_chart(
        reference_birth, config.model_copy(update={"include_outer_planets": False})
    )

    for aspect in chart.aspects:
        assert aspect.first not in OUTER_BODIES
        assert aspect.second not in OUTER_BODIES


def test_positions_are_internally_consistent(western):
    for position in western.positions:
        assert 0.0 <= position.longitude < 360.0
        assert position.sign == SIGNS[position.sign_index]
        assert position.sign_index == sign_index(position.longitude)
        assert position.degrees_in_sign == pytest.approx(
            position.longitude % 30.0
        )


def test_element_and_modality_follow_the_sign(western):
    """Both cycle regularly, so a mismatch means the tables are misaligned."""
    elements = ("Fire", "Earth", "Air", "Water")
    modalities = ("Cardinal", "Fixed", "Mutable")

    for position in western.positions:
        assert position.element == elements[position.sign_index % 4]
        assert position.modality == modalities[position.sign_index % 3]


def test_retrograde_follows_the_speed_sign(western):
    for position in western.positions:
        assert position.retrograde == (position.speed_longitude < 0.0)


# --- Angles ---------------------------------------------------------------


def test_descendant_is_opposite_the_ascendant(western):
    angles = western.angles

    assert (angles.descendant - angles.ascendant) % 360.0 == pytest.approx(180.0)


def test_imum_coeli_is_opposite_the_midheaven(western):
    angles = western.angles

    assert (angles.imum_coeli - angles.midheaven) % 360.0 == pytest.approx(180.0)


def test_ascendant_ruler_follows_its_sign(western):
    """Sagittarius rising is ruled by Jupiter under modern rulership."""
    assert western.angles.ascendant_sign == "Sagittarius"
    assert western.angles.ascendant_ruler == "Jupiter"


def test_first_cusp_is_the_ascendant(western):
    """In every house system the 1st cusp *is* the Ascendant."""
    assert western.houses[0].cusp_longitude == pytest.approx(
        western.angles.ascendant
    )


# --- Houses ---------------------------------------------------------------


def test_there_are_twelve_houses(western):
    assert len(western.houses) == 12
    assert [h.number for h in western.houses] == list(range(1, 13))


def test_house_sizes_cover_the_whole_circle(western):
    """Sizes must sum to 360: any gap or overlap would misplace bodies."""
    total = sum(house.size_degrees for house in western.houses)

    assert total == pytest.approx(360.0, abs=1e-6)


def test_placidus_houses_are_unequal(western):
    """Confirms a real house system is in use, not equal division.

    If these came back all 30 degrees, the configured system would be silently
    ignored and every body near a cusp could be in the wrong house.
    """
    sizes = {round(house.size_degrees, 3) for house in western.houses}

    assert len(sizes) > 1
    assert western.metadata.house_system == "placidus"


def test_opposite_placidus_houses_are_equal_in_size(western):
    """A property of the system: houses 1 and 7, 2 and 8, and so on, match."""
    for number in range(1, 7):
        first = western.houses[number - 1]
        opposite = western.houses[number + 5]

        assert first.size_degrees == pytest.approx(
            opposite.size_degrees, abs=1e-6
        )


def test_every_body_is_in_exactly_one_house(western):
    from_houses = [body for house in western.houses for body in house.bodies]

    assert sorted(from_houses) == sorted(p.body for p in western.positions)
    assert len(from_houses) == len(set(from_houses))


def test_house_occupancy_agrees_with_the_positions(western):
    for house in western.houses:
        for body in house.bodies:
            assert western.position(body).house == house.number


def test_house_assignment_walks_the_cusps(western):
    """A body must lie between its house's cusp and the next.

    Placidus houses are unequal, so dividing the circle by 30 would misplace
    bodies. This checks the cusps were actually walked.
    """
    cusps = [house.cusp_longitude for house in western.houses]

    for position in western.positions:
        start = cusps[position.house - 1]
        end = cusps[position.house % 12]
        offset = (position.longitude - start) % 360.0
        span = (end - start) % 360.0

        assert offset < span, (
            f"{position.body} at {position.longitude} is not inside house "
            f"{position.house} ({start} to {end})"
        )


def test_house_system_is_configurable(reference_birth, config):
    """Product spec §5 requires the Western house system be configurable."""
    equal = calculate_western_chart(
        reference_birth,
        config.model_copy(update={"western_house_system": HouseSystem.EQUAL}),
    )

    sizes = {round(house.size_degrees, 6) for house in equal.houses}
    assert sizes == {30.0}
    assert equal.metadata.house_system == "equal"


def test_western_house_system_is_independent_of_the_vedic_one(
    reference_birth, config
):
    """The two traditions default differently and must not share a setting."""
    assert config.house_system is HouseSystem.WHOLE_SIGN
    assert config.western_house_system is HouseSystem.PLACIDUS

    vedic = calculate_d1_chart(reference_birth, config)
    western = calculate_western_chart(reference_birth, config)

    vedic_sizes = {round(b.cusp_longitude % 30.0, 6) for b in vedic.bhavas}
    assert vedic_sizes == {0.0}  # whole sign: cusps on sign boundaries
    assert any(h.cusp_longitude % 30.0 > 0.001 for h in western.houses)


# --- Unknown birth time --------------------------------------------------


def test_unknown_birth_time_withholds_angles_and_houses(unknown_western):
    assert unknown_western.angles is None
    assert unknown_western.houses == ()
    assert all(p.house is None for p in unknown_western.positions)


def test_unknown_birth_time_names_what_is_missing(unknown_western):
    assert "angles" in unknown_western.metadata.unavailable
    assert "houses" in unknown_western.metadata.unavailable


def test_unknown_birth_time_still_places_bodies_in_signs(unknown_western):
    assert len(unknown_western.positions) == 10

    for position in unknown_western.positions:
        assert position.sign in SIGNS


def test_unknown_birth_time_keeps_a_mid_sign_moon_certain(unknown_western):
    """An unknown birth time does not automatically make the Moon doubtful.

    The Moon travels about 6.6 degrees either side of noon, so whether its
    sign survives depends on where in the sign it falls. On this date it sits
    at Gemini 13.6, comfortably inside, so the sign is answerable. Flagging it
    regardless would discard information we genuinely have.
    """
    assert unknown_western.position("Moon").uncertain is False
    assert unknown_western.position("Sun").uncertain is False


def test_unknown_birth_time_marks_a_moon_near_a_sign_boundary():
    """When the window straddles a cusp, the sign really is unanswerable.

    On 1990-08-03 the Moon sits at Capricorn 2.2, so a 24-hour window reaches
    back into Sagittarius and the sign cannot be stated.
    """
    birth = BirthData(
        birth_date=date(1990, 8, 3),
        time_confidence=BirthTimeConfidence.UNKNOWN,
        latitude=18.9756,
        longitude=72.8258,
        timezone_name="Asia/Kolkata",
    )

    chart = calculate_western_chart(birth)

    assert chart.position("Moon").uncertain is True
    assert chart.position("Saturn").uncertain is False


def test_unknown_birth_time_still_finds_aspects(unknown_western):
    """Aspects between slow bodies survive without a birth time."""
    assert unknown_western.aspects


def test_exact_birth_time_marks_nothing_uncertain(western):
    assert all(not p.uncertain for p in western.positions)


# --- Metadata ------------------------------------------------------------


def test_metadata_records_everything_needed_to_reproduce(western, config):
    metadata = western.metadata

    assert "swisseph" in metadata.engine_id
    assert metadata.calculation_version
    assert metadata.config == config
    assert metadata.moment.timezone_name == "Asia/Kolkata"
    assert metadata.house_system == "placidus"
    assert len(metadata.bodies_included) == 10


def test_chart_is_deterministic(reference_birth, config):
    first = calculate_western_chart(reference_birth, config)
    second = calculate_western_chart(reference_birth, config)

    assert first.model_dump_json() == second.model_dump_json()


def test_dst_handling_is_shared_with_the_vedic_service():
    """Birth-moment resolution is common ground, and must behave identically."""
    birth = BirthData(
        birth_date=date(2023, 11, 5),
        birth_time=time(1, 30),
        time_confidence=BirthTimeConfidence.EXACT,
        latitude=40.7128,
        longitude=-74.0060,
        timezone_name="America/New_York",
    )

    western = calculate_western_chart(birth)
    vedic = calculate_d1_chart(birth)

    assert western.metadata.moment.dst_anomaly.value == "AMBIGUOUS"
    assert (
        western.metadata.moment.utc_datetime == vedic.metadata.moment.utc_datetime
    )


# --- Engine boundary -----------------------------------------------------


def test_engine_exposes_both_frames_under_distinct_names(engine):
    """Frames are reached by name, never by a boolean flag."""
    jd = 2448118.875

    tropical = engine.tropical_positions(jd, ("Sun",))["Sun"].longitude
    sidereal = engine.sidereal_positions(jd, ("Sun",))["Sun"].longitude

    assert tropical != sidereal
    assert (tropical - sidereal) % 360.0 == pytest.approx(
        engine.ayanamsa(jd), abs=1e-9
    )


def test_tropical_houses_use_the_western_house_system(config):
    """The two house accessors must read their own configuration."""
    engine = SwissEphemerisEngine(
        config.model_copy(
            update={
                "house_system": HouseSystem.WHOLE_SIGN,
                "western_house_system": HouseSystem.PLACIDUS,
            }
        )
    )

    sidereal = engine.sidereal_houses(2448118.875, 18.9756, 72.8258)
    tropical = engine.tropical_houses(2448118.875, 18.9756, 72.8258)

    # Whole sign puts cusps on sign boundaries; Placidus does not.
    assert all(cusp % 30.0 == pytest.approx(0.0) for cusp in sidereal.cusps)
    assert any(cusp % 30.0 > 0.001 for cusp in tropical.cusps)


def test_outer_planets_are_rejected_by_name_typo(engine):
    with pytest.raises(Exception, match="unknown body"):
        engine.tropical_positions(2448118.875, ("Planet X",))


def test_unsupported_western_house_system_is_rejected(config):
    from app.services.astrology.common.ephemeris import EphemerisError

    broken = config.model_copy(update={"western_house_system": "koch"})

    with pytest.raises(EphemerisError, match="unsupported western house system"):
        SwissEphemerisEngine(broken)
