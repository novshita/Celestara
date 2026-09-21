"""Engine boundary regression tests.

Every test in this file corresponds to a defect found while validating
pyswisseph before the calculation layer was written. They are regression
guards: each one fails if the engine adapter reverts to the naive call that
produced wrong output.
"""

from __future__ import annotations

import pytest
import swisseph as swe

from app.core.config import (
    Ayanamsa,
    CalculationConfig,
    EphemerisSource,
    HouseSystem,
)
from app.services.astrology.common.ephemeris import (
    EphemerisEngine,
    EphemerisError,
)
from app.services.astrology.common.swisseph_engine import SwissEphemerisEngine

from .conftest import MUMBAI_LAT, MUMBAI_LON, REFERENCE_JD_UT

J2000 = 2451545.0


def test_adapter_satisfies_the_port(engine):
    """The adapter must remain substitutable for the protocol."""
    assert isinstance(engine, EphemerisEngine)


# --- Defect 1: whole-sign bhavas keyed to the tropical Ascendant -----------


def test_whole_sign_cusps_follow_the_sidereal_ascendant(engine):
    """Cusp 1 must be the sidereal Ascendant's rashi.

    Calling `houses_ex` without FLG_SIDEREAL returns whole-sign cusps built
    from the *tropical* Ascendant while the reported Ascendant is sidereal.
    At the reference moment that put cusp 1 in Sagittarius (240 deg) against a
    Scorpio Ascendant - every graha one full rashi off.
    """
    frame = engine.sidereal_houses(REFERENCE_JD_UT, MUMBAI_LAT, MUMBAI_LON)

    assert int(frame.cusps[0] // 30) == int(frame.ascendant // 30)


def test_whole_sign_cusps_are_exact_rashi_boundaries(engine):
    """Whole-sign cusps must land on 30-degree multiples."""
    frame = engine.sidereal_houses(REFERENCE_JD_UT, MUMBAI_LAT, MUMBAI_LON)

    for index, cusp in enumerate(frame.cusps):
        assert cusp % 30.0 == pytest.approx(0.0, abs=1e-9), (
            f"cusp {index + 1} at {cusp} is not a rashi boundary"
        )


def test_reference_ascendant_is_sidereal_scorpio(engine):
    """Pins the known-good sidereal Ascendant for the reference moment.

    The tropical Ascendant here is 254.4577 (Sagittarius). Reporting that
    value would mean the ayanamsa was never applied.
    """
    frame = engine.sidereal_houses(REFERENCE_JD_UT, MUMBAI_LAT, MUMBAI_LON)

    assert frame.ascendant == pytest.approx(230.7275, abs=1e-3)
    assert int(frame.ascendant // 30) == 7  # Vrischika / Scorpio
    assert frame.cusps[0] == pytest.approx(210.0, abs=1e-9)


# --- Defect 2: mean-vs-true ayanamsa leaves nutation in the result ---------


def test_reported_ayanamsa_reproduces_sidereal_output(engine):
    """The ayanamsa we report must be consistent with our own longitudes.

    `tropical - reported_ayanamsa` has to land exactly on the sidereal
    longitude. It only does so when the ayanamsa comes from
    `get_ayanamsa_ex_ut` with the same flags as the position call.
    """
    tropical, _ = swe.calc_ut(J2000, swe.SUN, swe.FLG_MOSEPH | swe.FLG_SPEED)
    sidereal = engine.sidereal_positions(J2000, ("Sun",))["Sun"].longitude
    reported = engine.ayanamsa(J2000)

    assert (tropical[0] - reported) % 360.0 == pytest.approx(sidereal, abs=1e-9)


def test_mean_ayanamsa_variant_is_not_used(engine):
    """Guard against 'simplifying' back to `get_ayanamsa_ut`.

    The plain variant is the mean ayanamsa and differs from the applied value
    by the nutation term - about 14 arcsec at J2000, up to ~17. Small enough
    to survive review, large enough to move a pada boundary.
    """
    swe.set_sid_mode(swe.SIDM_LAHIRI, 0, 0)
    mean = swe.get_ayanamsa_ut(J2000)
    applied = engine.ayanamsa(J2000)

    difference_arcsec = abs(applied - mean) * 3600.0
    assert 5.0 < difference_arcsec < 20.0, (
        f"expected the nutation term (~14 arcsec), got {difference_arcsec}; "
        f"if this is ~0 the adapter switched to the mean ayanamsa variant"
    )


def test_lahiri_ayanamsa_matches_published_value(engine):
    """Independent check: Lahiri at 2000-01-01 is ~23 deg 51'.

    Tolerance is one arcminute, which is loose enough to accept the published
    figure's own rounding but far tighter than the gap between ayanamsas -
    Raman and Krishnamurti differ from Lahiri by whole degrees, so a
    misconfigured sidereal mode still fails here.
    """
    value = engine.ayanamsa(swe.julday(2000, 1, 1, 0.0))

    assert value == pytest.approx(23.0 + 51.0 / 60.0, abs=1.0 / 60.0)


# --- Defect 3: silent fallback to Moshier when .se1 files are absent -------


def test_missing_swiss_data_files_raise_rather_than_downgrade(tmp_path):
    """A SWISS request with no data files must fail loudly.

    The library returns Moshier output and a success flag, so identical inputs
    would otherwise produce different charts depending on whether data files
    happen to be present - breaking reproducibility (spec §10).
    """
    engine = SwissEphemerisEngine(
        CalculationConfig(
            ephemeris_source=EphemerisSource.SWISS,
            ephemeris_path=str(tmp_path),
        )
    )

    with pytest.raises(EphemerisError, match="ephemeris source mismatch"):
        engine.sidereal_positions(REFERENCE_JD_UT, ("Sun",))


def test_swiss_source_requires_a_path():
    with pytest.raises(EphemerisError, match="requires ephemeris_path"):
        SwissEphemerisEngine(
            CalculationConfig(ephemeris_source=EphemerisSource.SWISS)
        )


def test_engine_id_records_what_produced_the_chart(engine):
    """Metadata must identify the engine, ephemeris and ayanamsa."""
    engine_id = engine.engine_id

    assert "swisseph" in engine_id
    assert EphemerisSource.MOSHIER.value in engine_id
    assert Ayanamsa.LAHIRI.value in engine_id


# --- General contract -----------------------------------------------------


def test_positions_are_deterministic(engine):
    """Identical inputs must give bit-identical output (spec §1)."""
    runs = {
        engine.sidereal_positions(REFERENCE_JD_UT, ("Moon",))["Moon"].longitude
        for _ in range(25)
    }

    assert len(runs) == 1


def test_ketu_is_rejected_as_a_calculated_body(engine):
    """Ketu is derived, not calculated; asking the engine for it is a bug."""
    with pytest.raises(EphemerisError, match="derived from Rahu"):
        engine.sidereal_positions(REFERENCE_JD_UT, ("Ketu",))


def test_unknown_body_is_rejected(engine):
    with pytest.raises(EphemerisError, match="unknown body"):
        engine.sidereal_positions(REFERENCE_JD_UT, ("Chiron",))


def test_unsupported_ayanamsa_is_rejected():
    """Only validated ayanamsas may be configured."""

    class Fake(str):
        value = "fake"

    config = CalculationConfig()
    broken = config.model_copy(update={"ayanamsa": Fake("fake")})

    with pytest.raises(EphemerisError, match="unsupported ayanamsa"):
        SwissEphemerisEngine(broken)


def test_all_house_systems_are_mapped(config):
    """Every HouseSystem value must be usable, not just the Vedic default."""
    for system in HouseSystem:
        engine = SwissEphemerisEngine(config.model_copy(update={"house_system": system}))
        frame = engine.sidereal_houses(REFERENCE_JD_UT, MUMBAI_LAT, MUMBAI_LON)

        assert len(frame.cusps) == 12
        # The Ascendant is a property of time and place, not of the house
        # division, so it must not drift between systems.
        assert frame.ascendant == pytest.approx(230.7275, abs=1e-3)
