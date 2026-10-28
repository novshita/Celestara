"""Transits across a period: when grahas change rashi or turn retrograde.

`calculate_transits` answers "where is everything now". A weekly or monthly
reading needs the next question: what *changes* between now and then. This
samples the sky once a day and, wherever a graha's rashi or direction of
travel differs between two samples, narrows the moment down by bisection to
within a minute - so an event is reported with a real time, not "sometime
this week".

Daily sampling can only miss a graha that crosses a rashi boundary and comes
back inside a single day. No graha (the Moon aside, which is excluded) moves
slowly enough in retrograde stations to be that quick, so it is not handled.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core.config import DEFAULT_CALCULATION_CONFIG, CalculationConfig
from app.domain.birth_data import BirthData
from app.domain.transit import (
    PeriodTransitReport,
    TransitEvent,
    TransitPosition,
    TransitSnapshot,
)
from app.domain.vedic import VedicChart
from app.services.astrology.common.constants import NAVAGRAHA, RASHIS
from app.services.astrology.common.ephemeris import EphemerisEngine
from app.services.astrology.common.swisseph_engine import SwissEphemerisEngine
from app.services.astrology.transit.service import (
    GRANULARITY_SECONDS,
    _bhava_from,
    _quantise,
    build_snapshot,
    relate_to_chart,
)
from app.services.astrology.vedic.d1 import calculate_d1_chart

#: Longest period accepted: bounds the work to ~a hundred ephemeris calls.
MAX_PERIOD_DAYS = 90

#: Excluded from events - see `PeriodTransitReport.events`.
_EXCLUDED = frozenset({"Moon"})

#: Nodes are not described as stationing; Rahu and Ketu only ever ingress.
_NO_STATIONS = frozenset({"Rahu", "Ketu"})


def _bisect(
    low: datetime,
    high: datetime,
    graha: str,
    changed,
    config: CalculationConfig,
    engine: EphemerisEngine,
) -> datetime:
    """The first moment, to within the snapshot resolution, at which
    `changed(position)` is true, given that it is false at `low` and true at
    `high`."""
    resolution = timedelta(seconds=GRANULARITY_SECONDS)
    while high - low > resolution:
        middle = low + (high - low) / 2
        position = build_snapshot(middle, config, engine).position(graha)
        if changed(position):
            high = middle
        else:
            low = middle
    # Positions are only ever calculated at the quantised minute, so that is
    # the moment `changed` was actually true at.
    return _quantise(high)


def _event(
    kind: str,
    position: TransitPosition,
    moment: datetime,
    from_rashi: str | None,
    ascendant_rashi: int | None,
    moon_rashi: int | None,
) -> TransitEvent:
    return TransitEvent(
        kind=kind,
        graha=position.graha,
        moment=moment,
        rashi=position.rashi,
        from_rashi=from_rashi,
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
    )


def _reference_rashis(chart: VedicChart) -> tuple[int | None, int | None]:
    ascendant = chart.ascendant.rashi_index if chart.ascendant else None
    moon = chart.placement("Moon")
    return ascendant, (moon.rashi_index if moon.certainty.rashi_certain else None)


def calculate_period_transits(
    birth: BirthData,
    days: int,
    at: datetime | None = None,
    config: CalculationConfig = DEFAULT_CALCULATION_CONFIG,
    engine: EphemerisEngine | None = None,
) -> PeriodTransitReport:
    """Transits from `at` (default now) across the next `days` days."""
    if not 1 <= days <= MAX_PERIOD_DAYS:
        raise ValueError(f"days must be between 1 and {MAX_PERIOD_DAYS}")

    engine = engine or SwissEphemerisEngine(config)
    chart = calculate_d1_chart(birth, config, engine)
    ascendant_rashi, moon_rashi = _reference_rashis(chart)

    start_snapshot = build_snapshot(at or datetime.now(timezone.utc), config, engine)
    start_report = relate_to_chart(start_snapshot, chart)

    samples: list[TransitSnapshot] = [start_snapshot]
    for day in range(1, days + 1):
        samples.append(
            build_snapshot(start_snapshot.moment + timedelta(days=day), config, engine)
        )

    events: list[TransitEvent] = []
    for graha in NAVAGRAHA:
        if graha in _EXCLUDED:
            continue
        for before, after in zip(samples, samples[1:]):
            a, b = before.position(graha), after.position(graha)

            if a.rashi_index != b.rashi_index:
                moment = _bisect(
                    before.moment, after.moment, graha,
                    lambda p, r=a.rashi_index: p.rashi_index != r, config, engine,
                )
                landed = build_snapshot(moment, config, engine).position(graha)
                events.append(
                    _event("ingress", landed, moment, RASHIS[a.rashi_index],
                           ascendant_rashi, moon_rashi)
                )

            if graha not in _NO_STATIONS and a.retrograde != b.retrograde:
                moment = _bisect(
                    before.moment, after.moment, graha,
                    lambda p, r=a.retrograde: p.retrograde != r, config, engine,
                )
                turned = build_snapshot(moment, config, engine).position(graha)
                events.append(
                    _event(
                        "station_retrograde" if b.retrograde else "station_direct",
                        turned, moment, None, ascendant_rashi, moon_rashi,
                    )
                )

    events.sort(key=lambda event: event.moment)
    return PeriodTransitReport(
        start=start_report,
        end=samples[-1].moment,
        days=days,
        events=tuple(events),
        unavailable=start_report.unavailable,
    )
