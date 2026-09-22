"""Western natal chart service.

Tropical positions, houses, angles and aspects. Structurally parallel to the
Vedic D1 service but sharing none of its calculation rules, per engineering
spec §16.
"""

from __future__ import annotations

from app.core.config import DEFAULT_CALCULATION_CONFIG, CalculationConfig
from app.domain.birth_data import BirthData, ResolvedBirthMoment, resolve_birth_moment
from app.domain.western import (
    Angles,
    House,
    PlanetPosition,
    WesternChart,
    WesternChartMetadata,
)
from app.services.astrology.common.ephemeris import (
    BodyPosition,
    EphemerisEngine,
    HouseFrame,
)
from app.services.astrology.common.swisseph_engine import SwissEphemerisEngine

from .aspects import find_aspects
from .constants import (
    DEGREES_PER_SIGN,
    SIGN_ELEMENTS,
    SIGN_MODALITIES,
    SIGN_RULERS,
    SIGNS,
    sign_index,
    western_bodies,
)

#: Samples across the birth-time window used to decide whether a body's sign
#: is answerable, matching the Vedic service's approach.
_CERTAINTY_SAMPLES = 5


def _house_of(longitude: float, cusps: tuple[float, ...]) -> int:
    """Which house a longitude falls in.

    Houses are not necessarily 30 degrees wide - Placidus in particular
    produces markedly unequal houses away from the equator - so this walks the
    cusps rather than dividing. Each house runs from its own cusp up to the
    next, wrapping through 0 degrees where needed.
    """
    position = longitude % 360.0

    for number in range(1, 13):
        start = cusps[number - 1]
        end = cusps[number % 12]

        if start <= end:
            if start <= position < end:
                return number
        else:
            # This house straddles 0 degrees.
            if position >= start or position < end:
                return number

    # Unreachable while the cusps cover the circle, which HouseFrame enforces.
    raise ValueError(f"no house contains longitude {longitude}")


def _house_size(number: int, cusps: tuple[float, ...]) -> float:
    start = cusps[number - 1]
    end = cusps[number % 12]
    return (end - start) % 360.0 or 360.0


def _to_position(
    position: BodyPosition,
    cusps: tuple[float, ...] | None,
    uncertain: bool,
) -> PlanetPosition:
    index = sign_index(position.longitude)

    return PlanetPosition(
        body=position.body,
        longitude=position.longitude,
        sign_index=index,
        sign=SIGNS[index],
        degrees_in_sign=position.longitude % DEGREES_PER_SIGN,
        element=SIGN_ELEMENTS[index],
        modality=SIGN_MODALITIES[index],
        retrograde=position.is_retrograde,
        speed_longitude=position.speed_longitude,
        house=_house_of(position.longitude, cusps) if cusps else None,
        uncertain=uncertain,
    )


def _assess_uncertainty(
    engine: EphemerisEngine,
    moment: ResolvedBirthMoment,
    bodies: tuple[str, ...],
) -> dict[str, bool]:
    """Which bodies' signs are not answerable given the birth-time window."""
    if moment.uncertainty_hours <= 0.0:
        return {body: False for body in bodies}

    low, high = moment.window_bounds_jd()
    step = (high - low) / (_CERTAINTY_SAMPLES - 1)

    seen: dict[str, set[int]] = {body: set() for body in bodies}
    for sample in range(_CERTAINTY_SAMPLES):
        jd = low + step * sample
        for body, position in engine.tropical_positions(jd, bodies).items():
            seen[body].add(sign_index(position.longitude))

    return {body: len(signs) > 1 for body, signs in seen.items()}


def _build_angles(frame: HouseFrame) -> Angles:
    ascendant_index = sign_index(frame.ascendant)

    return Angles(
        ascendant=frame.ascendant,
        ascendant_sign=SIGNS[ascendant_index],
        ascendant_degrees=frame.ascendant % DEGREES_PER_SIGN,
        ascendant_ruler=SIGN_RULERS[ascendant_index],
        midheaven=frame.midheaven,
        midheaven_sign=SIGNS[sign_index(frame.midheaven)],
        # The other two angles are always opposite their counterparts, so they
        # are derived rather than calculated.
        descendant=(frame.ascendant + 180.0) % 360.0,
        imum_coeli=(frame.midheaven + 180.0) % 360.0,
    )


def _build_houses(
    cusps: tuple[float, ...], positions: tuple[PlanetPosition, ...]
) -> tuple[House, ...]:
    occupants: dict[int, list[str]] = {}
    for position in positions:
        if position.house is not None:
            occupants.setdefault(position.house, []).append(position.body)

    houses: list[House] = []
    for number in range(1, 13):
        cusp = cusps[number - 1]
        index = sign_index(cusp)
        houses.append(
            House(
                number=number,
                cusp_longitude=cusp,
                sign_index=index,
                sign=SIGNS[index],
                ruler=SIGN_RULERS[index],
                size_degrees=_house_size(number, cusps),
                bodies=tuple(occupants.get(number, ())),
            )
        )
    return tuple(houses)


def calculate_western_chart(
    birth: BirthData,
    config: CalculationConfig = DEFAULT_CALCULATION_CONFIG,
    engine: EphemerisEngine | None = None,
) -> WesternChart:
    """Calculate a Western natal chart.

    An unknown birth time yields planets in signs but no angles and no houses,
    and marks any body whose sign the 24-hour window leaves in doubt.
    """
    engine = engine or SwissEphemerisEngine(config)

    moment = resolve_birth_moment(birth, julian_day=engine.julian_day_ut)
    bodies = western_bodies(config.include_outer_planets)

    raw = engine.tropical_positions(moment.julian_day_ut, bodies)
    uncertainty = _assess_uncertainty(engine, moment, bodies)

    unavailable: list[str] = []
    cusps: tuple[float, ...] | None = None
    angles: Angles | None = None

    if moment.has_usable_time:
        frame = engine.tropical_houses(
            moment.julian_day_ut, birth.latitude, birth.longitude
        )
        cusps = frame.cusps
        angles = _build_angles(frame)
    else:
        unavailable.extend(("angles", "houses", "house_placements"))

    positions = tuple(
        _to_position(raw[body], cusps, uncertainty[body]) for body in bodies
    )

    houses = _build_houses(cusps, positions) if cusps is not None else ()

    return WesternChart(
        positions=positions,
        houses=houses,
        angles=angles,
        aspects=find_aspects(raw, bodies, config),
        metadata=WesternChartMetadata(
            engine_id=engine.engine_id,
            calculation_version=config.calculation_version,
            config=config,
            moment=moment,
            house_system=config.western_house_system.value,
            bodies_included=bodies,
            unavailable=tuple(unavailable),
        ),
    )
