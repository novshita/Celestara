"""Vimshottari Dasha timeline service.

The timeline is seeded entirely from the Moon's position within its nakshatra:
that fixes which lord rules first, and how much of their period was already
spent before birth. Everything else follows mechanically.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from app.core.config import (
    DASHA_YEAR_DAYS,
    DEFAULT_CALCULATION_CONFIG,
    CalculationConfig,
)
from app.domain.birth_data import BirthData, ResolvedBirthMoment
from app.domain.dasha import (
    DASHA_LEVEL_ORDER,
    DashaLevel,
    DashaPeriod,
    DashaTimeline,
)
from app.domain.vedic import NakshatraPosition
from app.services.astrology.common.constants import (
    DEGREES_PER_NAKSHATRA,
    NAKSHATRA_LORD_CYCLE,
    NAKSHATRAS,
    VIMSHOTTARI_PERIOD_YEARS,
    VIMSHOTTARI_TOTAL_YEARS,
    nakshatra_index,
    nakshatra_lord,
    pada_number,
)
from app.services.astrology.common.ephemeris import EphemerisEngine
from app.services.astrology.common.swisseph_engine import SwissEphemerisEngine
from app.services.astrology.vedic.d1 import calculate_d1_chart


class DashaUnavailableError(RuntimeError):
    """The timeline cannot be derived from the available birth data.

    Raised rather than returning an approximate timeline: the starting lord
    depends on which nakshatra the Moon occupies, so if that is unknown there
    is no "roughly right" answer to give - a different lord means a different
    120-year sequence (product spec §8).
    """


def _order_from(lord: str) -> tuple[str, ...]:
    """The nine lords in Vimshottari order, rotated to begin at `lord`."""
    start = NAKSHATRA_LORD_CYCLE.index(lord)
    return NAKSHATRA_LORD_CYCLE[start:] + NAKSHATRA_LORD_CYCLE[:start]


def _year_days(config: CalculationConfig) -> float:
    return DASHA_YEAR_DAYS[config.dasha_year_length]


def _to_timedelta(years: float, config: CalculationConfig) -> timedelta:
    return timedelta(days=years * _year_days(config))


def _to_years(span: timedelta, config: CalculationConfig) -> float:
    return span.total_seconds() / (_year_days(config) * 86400.0)


def _elapsed_fraction(moon_longitude: float, index: int) -> float:
    """How far through nakshatra `index` the Moon has travelled, as 0.0-1.0.

    Measured from the nakshatra index the chart reports rather than by an
    independent modulo, so the fraction can never disagree with the nakshatra
    it is supposed to describe - the two are used together to pick the
    starting lord.
    """
    offset = moon_longitude - index * DEGREES_PER_NAKSHATRA
    return min(max(offset / DEGREES_PER_NAKSHATRA, 0.0), 1.0)


def _build_period(
    lord: str,
    level: DashaLevel,
    nominal_start: datetime,
    nominal_years: float,
    *,
    clip_start: datetime,
    levels_remaining: int,
    config: CalculationConfig,
) -> DashaPeriod:
    """Build one period and its descendants.

    `nominal_start` and `nominal_years` describe the period as it would be
    untruncated. `clip_start` is the birth moment: anything before it has
    already elapsed and is trimmed away. Children are always laid out across
    the *nominal* span and then clipped, never compressed into the remainder -
    squeezing them would silently shift every sub-period boundary.
    """
    nominal_end = nominal_start + _to_timedelta(nominal_years, config)
    effective_start = max(nominal_start, clip_start)

    sub_periods: tuple[DashaPeriod, ...] = ()
    if levels_remaining > 1:
        sub_periods = _build_sub_periods(
            parent_lord=lord,
            parent_level=level,
            parent_start=nominal_start,
            parent_years=nominal_years,
            clip_start=clip_start,
            levels_remaining=levels_remaining,
            config=config,
        )

    return DashaPeriod(
        lord=lord,
        level=level,
        start=effective_start,
        end=nominal_end,
        duration_years=_to_years(nominal_end - effective_start, config),
        is_partial=nominal_start < clip_start,
        sub_periods=sub_periods,
    )


def _build_sub_periods(
    *,
    parent_lord: str,
    parent_level: DashaLevel,
    parent_start: datetime,
    parent_years: float,
    clip_start: datetime,
    levels_remaining: int,
    config: CalculationConfig,
) -> tuple[DashaPeriod, ...]:
    """Subdivide a period using the same nine lords, starting from its own.

    Each child takes the share of the parent that its own period length bears
    to the full 120 years, so the children always sum back to the parent.
    """
    child_level = DASHA_LEVEL_ORDER[DASHA_LEVEL_ORDER.index(parent_level) + 1]

    children: list[DashaPeriod] = []
    cursor = parent_start

    for child_lord in _order_from(parent_lord):
        child_years = (
            parent_years
            * VIMSHOTTARI_PERIOD_YEARS[child_lord]
            / VIMSHOTTARI_TOTAL_YEARS
        )
        child_end = cursor + _to_timedelta(child_years, config)

        # Children that finished before birth are dropped entirely; the one
        # straddling birth is kept and trimmed.
        if child_end > clip_start:
            children.append(
                _build_period(
                    child_lord,
                    child_level,
                    cursor,
                    child_years,
                    clip_start=clip_start,
                    levels_remaining=levels_remaining - 1,
                    config=config,
                )
            )

        cursor = child_end

    return tuple(children)


def build_timeline(
    moon_longitude: float,
    moment: ResolvedBirthMoment,
    config: CalculationConfig = DEFAULT_CALCULATION_CONFIG,
    *,
    uncertainty_days: float = 0.0,
) -> DashaTimeline:
    """Build a timeline from the Moon's sidereal longitude.

    Pure: no ephemeris access, so it can be exercised at any Moon position
    without calculating a chart.
    """
    index = nakshatra_index(moon_longitude)
    lord = nakshatra_lord(index)
    fraction = _elapsed_fraction(moon_longitude, index)

    full_years = float(VIMSHOTTARI_PERIOD_YEARS[lord])
    balance_years = full_years * (1.0 - fraction)

    birth = moment.utc_datetime

    # The first Mahadasha began before birth. Anchoring it at its true start
    # and clipping is what lets the first Antardasha be correctly partial too.
    first_start = birth - _to_timedelta(full_years * fraction, config)

    sequence = [
        maha_lord
        for _ in range(config.dasha_cycles)
        for maha_lord in _order_from(lord)
    ]

    periods: list[DashaPeriod] = []
    cursor = first_start

    for maha_lord in sequence:
        nominal_years = float(VIMSHOTTARI_PERIOD_YEARS[maha_lord])
        periods.append(
            _build_period(
                maha_lord,
                DashaLevel.MAHA,
                cursor,
                nominal_years,
                clip_start=birth,
                levels_remaining=config.dasha_levels,
                config=config,
            )
        )
        cursor = cursor + _to_timedelta(nominal_years, config)

    return DashaTimeline(
        moon_nakshatra=NakshatraPosition(
            index=index,
            name=NAKSHATRAS[index],
            pada=pada_number(moon_longitude),
            lord=lord,
        ),
        starting_lord=lord,
        elapsed_fraction=fraction,
        balance_years=balance_years,
        periods=tuple(periods),
        year_length=config.dasha_year_length,
        year_days=_year_days(config),
        uncertainty_days=uncertainty_days,
        config=config,
        moment=moment,
    )


def _boundary_uncertainty_days(
    birth: BirthData,
    moment: ResolvedBirthMoment,
    config: CalculationConfig,
    engine: EphemerisEngine,
) -> float:
    """How far period boundaries could move given birth-time uncertainty.

    The Moon covers about 13 degrees a day, so even an hour of doubt shifts
    its position within the nakshatra - which shifts the balance of the first
    Mahadasha and therefore every boundary after it. Reported in days so the
    UI can qualify dates instead of implying precision it does not have.
    """
    if moment.uncertainty_hours <= 0.0:
        return 0.0

    low, high = moment.window_bounds_jd()
    balances = []
    for jd in (low, high):
        longitude = engine.sidereal_positions(jd, ("Moon",))["Moon"].longitude
        index = nakshatra_index(longitude)
        lord = nakshatra_lord(index)
        fraction = _elapsed_fraction(longitude, index)
        balances.append(VIMSHOTTARI_PERIOD_YEARS[lord] * (1.0 - fraction))

    spread_years = abs(balances[0] - balances[1])
    return spread_years * _year_days(config) / 2.0


def calculate_vimshottari(
    birth: BirthData,
    config: CalculationConfig = DEFAULT_CALCULATION_CONFIG,
    engine: EphemerisEngine | None = None,
) -> DashaTimeline:
    """Calculate the Vimshottari timeline for a birth record.

    Raises `DashaUnavailableError` when the Moon's nakshatra is not certain,
    which is the case whenever the birth time is unknown.
    """
    engine = engine or SwissEphemerisEngine(config)

    chart = calculate_d1_chart(birth, config, engine)

    if chart.moon_nakshatra is None:
        raise DashaUnavailableError(
            "The Vimshottari timeline is seeded from the Moon's nakshatra, "
            "which cannot be determined without a birth time. Across a single "
            "day the Moon travels far enough to change nakshatra, which would "
            "change the ruling lord and therefore the entire 120-year "
            "sequence."
        )

    moon = chart.placement("Moon")

    return build_timeline(
        moon.longitude,
        chart.metadata.moment,
        config,
        uncertainty_days=_boundary_uncertainty_days(
            birth, chart.metadata.moment, config, engine
        ),
    )
