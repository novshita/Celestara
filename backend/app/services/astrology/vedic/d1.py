"""Vedic D1 / Rashi calculation service.

Turns birth data into a structured Janma Kundali. Deterministic: identical
input plus identical `CalculationConfig` always yields identical output.
"""

from __future__ import annotations

from app.core.config import CalculationConfig, DEFAULT_CALCULATION_CONFIG
from app.domain.birth_data import (
    BirthData,
    BirthTimeConfidence,
    ResolvedBirthMoment,
    resolve_birth_moment,
)
from app.domain.vedic import (
    Ascendant,
    Bhava,
    Certainty,
    ChartMetadata,
    GrahaPlacement,
    NakshatraPosition,
    VedicChart,
)
from app.services.astrology.common.constants import (
    CALCULATED_BODIES,
    DEGREES_PER_RASHI,
    NAKSHATRAS,
    NAVAGRAHA,
    RASHI_LORDS,
    RASHIS,
    nakshatra_index,
    nakshatra_lord,
    pada_number,
    rashi_index,
)
from app.services.astrology.common.ephemeris import BodyPosition, EphemerisEngine
from app.services.astrology.common.swisseph_engine import SwissEphemerisEngine

#: Points across the birth-time uncertainty window at which a classification
#: is re-checked. The endpoints alone would miss a boundary crossed and
#: re-crossed; five samples over at most 24 hours is ample given the Moon is
#: the fastest body at ~13.2 deg/day and never retrogrades.
_CERTAINTY_SAMPLES = 5


def _nakshatra_at(longitude: float) -> NakshatraPosition:
    index = nakshatra_index(longitude)
    return NakshatraPosition(
        index=index,
        name=NAKSHATRAS[index],
        pada=pada_number(longitude),
        lord=nakshatra_lord(index),
    )


def _ketu_from_rahu(rahu: BodyPosition) -> BodyPosition:
    """Ketu is exactly opposite Rahu, by definition rather than by calculation."""
    return BodyPosition(
        body="Ketu",
        longitude=(rahu.longitude + 180.0) % 360.0,
        latitude=-rahu.latitude,
        distance_au=rahu.distance_au,
        speed_longitude=rahu.speed_longitude,
    )


def _all_positions(engine: EphemerisEngine, jd_ut: float) -> dict[str, BodyPosition]:
    """Positions for the full Navagraha, with Ketu mirrored from Rahu."""
    positions = dict(engine.sidereal_positions(jd_ut, CALCULATED_BODIES))
    positions["Ketu"] = _ketu_from_rahu(positions["Rahu"])
    return positions


def _assess_certainty(
    engine: EphemerisEngine,
    moment: ResolvedBirthMoment,
) -> dict[str, Certainty]:
    """Re-classify each graha across the uncertainty window.

    A classification is certain only if it is identical at every sample. An
    exact birth time has a zero-width window, so everything is certain and no
    extra ephemeris calls are made.
    """
    if moment.uncertainty_hours <= 0.0:
        return {graha: Certainty() for graha in NAVAGRAHA}

    low, high = moment.window_bounds_jd()
    step = (high - low) / (_CERTAINTY_SAMPLES - 1)

    seen: dict[str, set[tuple[int, int, int]]] = {graha: set() for graha in NAVAGRAHA}
    for sample in range(_CERTAINTY_SAMPLES):
        jd = low + step * sample
        for graha, position in _all_positions(engine, jd).items():
            seen[graha].add(
                (
                    rashi_index(position.longitude),
                    nakshatra_index(position.longitude),
                    pada_number(position.longitude),
                )
            )

    certainty: dict[str, Certainty] = {}
    for graha, classifications in seen.items():
        certainty[graha] = Certainty(
            rashi_certain=len({c[0] for c in classifications}) == 1,
            nakshatra_certain=len({c[1] for c in classifications}) == 1,
            pada_certain=len({c[:3] for c in classifications}) == 1,
        )
    return certainty


def _build_placements(
    positions: dict[str, BodyPosition],
    certainty: dict[str, Certainty],
    ascendant_rashi: int | None,
) -> tuple[GrahaPlacement, ...]:
    placements: list[GrahaPlacement] = []

    for graha in NAVAGRAHA:
        position = positions[graha]
        index = rashi_index(position.longitude)

        bhava: int | None = None
        if ascendant_rashi is not None:
            # Whole-sign: the Ascendant's rashi is the 1st bhava in full, so a
            # graha's bhava follows from its rashi alone.
            bhava = ((index - ascendant_rashi) % 12) + 1

        placements.append(
            GrahaPlacement(
                graha=graha,
                longitude=position.longitude,
                rashi_index=index,
                rashi=RASHIS[index],
                degrees_in_rashi=position.longitude % DEGREES_PER_RASHI,
                nakshatra=_nakshatra_at(position.longitude),
                # Rahu and Ketu are always retrograde; the mean node's negative
                # speed carries through the mirroring, so this needs no special
                # case.
                retrograde=position.is_retrograde,
                speed_longitude=position.speed_longitude,
                bhava=bhava,
                certainty=certainty[graha],
                derived_from="Rahu" if graha == "Ketu" else None,
            )
        )

    return tuple(placements)


def _build_bhavas(
    ascendant_rashi: int,
    cusps: tuple[float, ...],
    placements: tuple[GrahaPlacement, ...],
) -> tuple[Bhava, ...]:
    occupants: dict[int, list[str]] = {}
    for placement in placements:
        if placement.bhava is not None:
            occupants.setdefault(placement.bhava, []).append(placement.graha)

    bhavas: list[Bhava] = []
    for number in range(1, 13):
        index = (ascendant_rashi + number - 1) % 12
        bhavas.append(
            Bhava(
                number=number,
                rashi_index=index,
                rashi=RASHIS[index],
                lord=RASHI_LORDS[index],
                cusp_longitude=cusps[number - 1],
                grahas=tuple(occupants.get(number, ())),
            )
        )
    return tuple(bhavas)


def calculate_d1_chart(
    birth: BirthData,
    config: CalculationConfig = DEFAULT_CALCULATION_CONFIG,
    engine: EphemerisEngine | None = None,
) -> VedicChart:
    """Calculate the Rashi (D1) chart for a birth record.

    An unknown birth time yields grahas without an Ascendant or bhavas, and
    marks whichever classifications the 24-hour window makes unanswerable.
    """
    engine = engine or SwissEphemerisEngine(config)

    moment = resolve_birth_moment(birth, julian_day=engine.julian_day_ut)
    positions = _all_positions(engine, moment.julian_day_ut)
    certainty = _assess_certainty(engine, moment)

    unavailable: list[str] = []
    ascendant: Ascendant | None = None
    ascendant_rashi: int | None = None
    cusps: tuple[float, ...] | None = None
    bhavas: tuple[Bhava, ...] = ()

    if moment.has_usable_time:
        frame = engine.sidereal_houses(
            moment.julian_day_ut, birth.latitude, birth.longitude
        )
        cusps = frame.cusps
        ascendant_rashi = rashi_index(frame.ascendant)
        ascendant = Ascendant(
            longitude=frame.ascendant,
            rashi_index=ascendant_rashi,
            rashi=RASHIS[ascendant_rashi],
            degrees_in_rashi=frame.ascendant % DEGREES_PER_RASHI,
            lord=RASHI_LORDS[ascendant_rashi],
            nakshatra=_nakshatra_at(frame.ascendant),
        )
    else:
        # Spec §9: do not fabricate an Ascendant or invent house positions.
        unavailable.extend(
            (
                "ascendant",
                "bhavas",
                "bhava_placements",
            )
        )

    placements = _build_placements(positions, certainty, ascendant_rashi)

    if ascendant_rashi is not None and cusps is not None:
        bhavas = _build_bhavas(ascendant_rashi, cusps, placements)

    moon = next(p for p in placements if p.graha == "Moon")
    moon_nakshatra = moon.nakshatra if moon.certainty.nakshatra_certain else None
    if moon_nakshatra is None:
        # The Vimshottari Dasha timeline is seeded from this, so its absence
        # has to propagate rather than be defaulted.
        unavailable.append("moon_nakshatra")

    metadata = ChartMetadata(
        engine_id=engine.engine_id,
        calculation_version=config.calculation_version,
        config=config,
        moment=moment,
        ayanamsa_degrees=engine.ayanamsa(moment.julian_day_ut),
        unavailable=tuple(unavailable),
    )

    return VedicChart(
        placements=placements,
        bhavas=bhavas,
        ascendant=ascendant,
        moon_nakshatra=moon_nakshatra,
        metadata=metadata,
    )
