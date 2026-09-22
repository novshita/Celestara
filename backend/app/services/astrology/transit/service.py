"""Transit (Gochar) service.

Answers two questions: where the grahas are now, and what that means relative
to a natal chart.

The split matters for caching. A snapshot holds no personal data, so it can be
reused across every user asking about the same moment. A report is derived from
someone's birth chart and is personal - it is never cached.
"""

from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache

from app.core.config import DEFAULT_CALCULATION_CONFIG, CalculationConfig
from app.domain.birth_data import BirthData
from app.domain.transit import (
    GrahaTransit,
    TransitPosition,
    TransitReport,
    TransitSnapshot,
)
from app.domain.vedic import NakshatraPosition, VedicChart
from app.services.astrology.common.constants import (
    CALCULATED_BODIES,
    DEGREES_PER_RASHI,
    NAKSHATRAS,
    NAVAGRAHA,
    RASHIS,
    nakshatra_index,
    nakshatra_lord,
    pada_number,
    rashi_index,
)
from app.services.astrology.common.ephemeris import BodyPosition, EphemerisEngine
from app.services.astrology.common.swisseph_engine import SwissEphemerisEngine
from app.services.astrology.vedic.d1 import calculate_d1_chart

#: Requests are rounded to this resolution before calculating, so repeated
#: requests within the same minute reuse one result. The Moon is the fastest
#: body at ~13.2 degrees a day, which is about 0.55 arcminutes per minute of
#: time - far below the resolution at which any interpretation changes.
GRANULARITY_SECONDS = 60

#: Snapshots held in memory. Each is a few hundred bytes and contains no
#: personal data. Sized for a working set of recent moments rather than as a
#: long-lived store; persistent transit snapshots are a later concern.
_CACHE_SIZE = 512


def _quantise(moment: datetime) -> datetime:
    """Round a moment down to the cache granularity, in UTC."""
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    moment = moment.astimezone(timezone.utc)

    seconds = moment.hour * 3600 + moment.minute * 60 + moment.second
    floored = seconds - (seconds % GRANULARITY_SECONDS)

    return moment.replace(
        hour=floored // 3600,
        minute=(floored % 3600) // 60,
        second=floored % 60,
        microsecond=0,
    )


def _to_position(position: BodyPosition) -> TransitPosition:
    index = rashi_index(position.longitude)
    nakshatra = nakshatra_index(position.longitude)

    return TransitPosition(
        graha=position.body,
        longitude=position.longitude,
        rashi_index=index,
        rashi=RASHIS[index],
        degrees_in_rashi=position.longitude % DEGREES_PER_RASHI,
        nakshatra=NakshatraPosition(
            index=nakshatra,
            name=NAKSHATRAS[nakshatra],
            pada=pada_number(position.longitude),
            lord=nakshatra_lord(nakshatra),
        ),
        retrograde=position.is_retrograde,
        speed_longitude=position.speed_longitude,
        derived_from="Rahu" if position.body == "Ketu" else None,
    )


def _ketu_from_rahu(rahu: BodyPosition) -> BodyPosition:
    return BodyPosition(
        body="Ketu",
        longitude=(rahu.longitude + 180.0) % 360.0,
        latitude=-rahu.latitude,
        distance_au=rahu.distance_au,
        speed_longitude=rahu.speed_longitude,
    )


def build_snapshot(
    moment: datetime,
    config: CalculationConfig,
    engine: EphemerisEngine,
) -> TransitSnapshot:
    """Calculate graha positions for a moment. No caching, no personal data."""
    quantised = _quantise(moment)

    hour_fraction = (
        quantised.hour + quantised.minute / 60.0 + quantised.second / 3600.0
    )
    jd = engine.julian_day_ut(
        quantised.year, quantised.month, quantised.day, hour_fraction
    )

    raw = dict(engine.sidereal_positions(jd, CALCULATED_BODIES))
    raw["Ketu"] = _ketu_from_rahu(raw["Rahu"])

    return TransitSnapshot(
        moment=quantised,
        julian_day_ut=jd,
        granularity_seconds=GRANULARITY_SECONDS,
        positions=tuple(_to_position(raw[graha]) for graha in NAVAGRAHA),
        engine_id=engine.engine_id,
        calculation_version=config.calculation_version,
        config=config,
    )


@lru_cache(maxsize=_CACHE_SIZE)
def _cached_snapshot(quantised_iso: str, config_json: str) -> TransitSnapshot:
    """Cache layer.

    Keyed on the quantised moment *and* the full configuration, because a
    different ayanamsa or ephemeris produces different positions for the same
    instant. Omitting the config from the key would serve one user's settings
    to another (engineering spec §28).

    The engine is constructed here rather than passed in so the key stays
    hashable and cannot accidentally include an unhashable object.
    """
    config = CalculationConfig.model_validate_json(config_json)
    engine = SwissEphemerisEngine(config)
    return build_snapshot(datetime.fromisoformat(quantised_iso), config, engine)


def current_snapshot(
    at: datetime | None = None,
    config: CalculationConfig = DEFAULT_CALCULATION_CONFIG,
    engine: EphemerisEngine | None = None,
) -> TransitSnapshot:
    """Graha positions now, or at `at`.

    Passing an explicit `engine` bypasses the cache, which is what tests want
    when they need to count engine calls or inject a stand-in.
    """
    moment = at or datetime.now(timezone.utc)

    if engine is not None:
        return build_snapshot(moment, config, engine)

    return _cached_snapshot(
        _quantise(moment).isoformat(), config.model_dump_json()
    )


def clear_snapshot_cache() -> None:
    """Drop cached snapshots. Used by tests and after a config change."""
    _cached_snapshot.cache_clear()


def _separation(first: float, second: float) -> float:
    delta = abs((first - second) % 360.0)
    return min(delta, 360.0 - delta)


def _bhava_from(reference_rashi: int, transit_rashi: int) -> int:
    """Whole-sign count from a reference rashi to a transiting one."""
    return ((transit_rashi - reference_rashi) % 12) + 1


def relate_to_chart(
    snapshot: TransitSnapshot, chart: VedicChart
) -> TransitReport:
    """Relate a snapshot to a natal chart.

    Two reference points are reported because both are used in practice: the
    Ascendant, and the natal Moon's rashi (Chandra Lagna), which is the
    traditional Gochar reference. Each has its own availability - the
    Ascendant needs a birth time, the Moon's rashi needs the Moon's placement
    to be certain - so one can be present while the other is not.
    """
    unavailable: list[str] = []

    ascendant_rashi = (
        chart.ascendant.rashi_index if chart.ascendant is not None else None
    )
    if ascendant_rashi is None:
        unavailable.append("bhava_from_ascendant")

    natal_moon = chart.placement("Moon")
    moon_rashi = (
        natal_moon.rashi_index if natal_moon.certainty.rashi_certain else None
    )
    if moon_rashi is None:
        unavailable.append("bhava_from_moon")

    transits: list[GrahaTransit] = []
    for graha in NAVAGRAHA:
        natal = chart.placement(graha)
        position = snapshot.position(graha)

        transits.append(
            GrahaTransit(
                graha=graha,
                transit=position,
                natal_longitude=natal.longitude,
                natal_rashi=natal.rashi,
                bhava_from_ascendant=(
                    _bhava_from(ascendant_rashi, position.rashi_index)
                    if ascendant_rashi is not None
                    else None
                ),
                bhava_from_moon=(
                    _bhava_from(moon_rashi, position.rashi_index)
                    if moon_rashi is not None
                    else None
                ),
                in_natal_rashi=position.rashi_index == natal.rashi_index,
                separation_from_natal=_separation(
                    position.longitude, natal.longitude
                ),
            )
        )

    return TransitReport(
        snapshot=snapshot,
        transits=tuple(transits),
        natal_ascendant_rashi=(
            chart.ascendant.rashi if chart.ascendant is not None else None
        ),
        natal_moon_rashi=(
            natal_moon.rashi if moon_rashi is not None else None
        ),
        unavailable=tuple(unavailable),
    )


def calculate_transits(
    birth: BirthData,
    at: datetime | None = None,
    config: CalculationConfig = DEFAULT_CALCULATION_CONFIG,
    engine: EphemerisEngine | None = None,
) -> TransitReport:
    """Current transits for a birth record.

    Unlike the Dasha timeline this does not require a birth time. Without one
    the transiting positions are still exact - they depend on the present
    moment, not on the birth - and only the natal-relative parts are withheld.
    """
    engine = engine or SwissEphemerisEngine(config)

    chart = calculate_d1_chart(birth, config, engine)
    snapshot = current_snapshot(at, config, engine)

    return relate_to_chart(snapshot, chart)
