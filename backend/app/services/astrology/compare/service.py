"""Compare service.

Runs the Vedic and Western pipelines and reports the factual differences
between their results. Per engineering spec §16, this consumes both charts'
output but must never merge the two systems' calculation rules - nothing here
recomputes a position; it only describes two results that were already
calculated independently.
"""

from __future__ import annotations

from app.core.config import DEFAULT_CALCULATION_CONFIG, CalculationConfig
from app.domain.birth_data import BirthData
from app.domain.compare import (
    AscendantComparison,
    ChartComparison,
    ComparisonMetadata,
    SharedBodyComparison,
)
from app.domain.vedic import VedicChart
from app.domain.western import WesternChart
from app.services.astrology.common.ephemeris import EphemerisEngine
from app.services.astrology.common.swisseph_engine import SwissEphemerisEngine
from app.services.astrology.vedic.d1 import calculate_d1_chart
from app.services.astrology.western.chart import calculate_western_chart
from app.services.astrology.western.constants import sign_index as western_sign_index


def _shared_bodies(
    vedic: VedicChart, western: WesternChart
) -> tuple[SharedBodyComparison, ...]:
    """Every body both systems calculate, in Vedic Navagraha order.

    Rahu and Ketu have no Western counterpart, and Uranus/Neptune/Pluto have no
    Vedic one (and may be configured off entirely), so this is always the
    seven classical bodies - never assumed, always the actual intersection.
    """
    western_by_body = {position.body: position for position in western.positions}

    comparisons = []
    for placement in vedic.placements:
        position = western_by_body.get(placement.graha)
        if position is None:
            continue

        comparisons.append(
            SharedBodyComparison(
                body=placement.graha,
                vedic_rashi=placement.rashi,
                vedic_degrees_in_rashi=placement.degrees_in_rashi,
                western_sign=position.sign,
                western_degrees_in_sign=position.degrees_in_sign,
                signs_apart=(position.sign_index - placement.rashi_index) % 12,
                vedic_uncertain=not placement.certainty.rashi_certain,
                western_uncertain=position.uncertain,
            )
        )
    return tuple(comparisons)


def _ascendant(
    vedic: VedicChart, western: WesternChart
) -> AscendantComparison | None:
    """None when either side lacks one, i.e. the birth time is unknown."""
    if vedic.ascendant is None or western.angles is None:
        return None

    w_index = western_sign_index(western.angles.ascendant)
    return AscendantComparison(
        vedic_rashi=vedic.ascendant.rashi,
        western_sign=western.angles.ascendant_sign,
        signs_apart=(w_index - vedic.ascendant.rashi_index) % 12,
    )


def calculate_comparison(
    birth: BirthData,
    config: CalculationConfig = DEFAULT_CALCULATION_CONFIG,
    engine: EphemerisEngine | None = None,
) -> ChartComparison:
    """Calculate the Vedic and Western charts for one birth record and report
    how they differ.

    The same engine instance calculates both charts, so the two are anchored
    to identical astronomical positions rather than two separate ephemeris
    lookups that could in principle disagree by a rounding hair.

    An unknown birth time is accepted, same as the two underlying endpoints:
    both charts are still returned, `shared_bodies` still compares signs, and
    only `ascendant` is withheld and named in `metadata.unavailable`.
    """
    engine = engine or SwissEphemerisEngine(config)

    vedic = calculate_d1_chart(birth, config, engine=engine)
    western = calculate_western_chart(birth, config, engine=engine)

    ascendant = _ascendant(vedic, western)

    return ChartComparison(
        vedic=vedic,
        western=western,
        shared_bodies=_shared_bodies(vedic, western),
        ascendant=ascendant,
        metadata=ComparisonMetadata(
            ayanamsa_degrees=vedic.metadata.ayanamsa_degrees,
            unavailable=() if ascendant is not None else ("ascendant",),
        ),
    )
