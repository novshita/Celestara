"""Vimshottari Dasha timeline schema.

The Dasha system divides a life into planetary periods totalling 120 years.
Which lord starts, and how much of that first period remains at birth, are
both derived from the Moon's exact position within its nakshatra - so this is
the most birth-time-sensitive output in the whole application.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.core.config import CalculationConfig, DashaYearLength
from app.domain.birth_data import ResolvedBirthMoment
from app.domain.vedic import NakshatraPosition


class DashaLevel(str, Enum):
    """Nesting depth of a period.

    Each level subdivides its parent using the same nine lords in the same
    order, so the structure is self-similar all the way down.
    """

    MAHA = "maha"
    """Major period. Nine of them span the 120-year cycle."""

    ANTAR = "antar"
    """Sub-period within a Mahadasha."""

    PRATYANTAR = "pratyantar"
    """Sub-period within an Antardasha."""

    SOOKSHMA = "sookshma"
    """Sub-period within a Pratyantardasha."""


#: Level order, used to decide what a period's children should be.
DASHA_LEVEL_ORDER: tuple[DashaLevel, ...] = (
    DashaLevel.MAHA,
    DashaLevel.ANTAR,
    DashaLevel.PRATYANTAR,
    DashaLevel.SOOKSHMA,
)


class DashaPeriod(BaseModel):
    """One planetary period, with its sub-periods nested inside."""

    model_config = {"frozen": True}

    lord: str
    level: DashaLevel

    start: datetime
    end: datetime

    duration_years: float
    """Length in Dasha years, which are defined by `dasha_year_length` and are
    not calendar years."""

    is_partial: bool = False
    """True for the first Mahadasha, which is truncated by however far the Moon
    had already travelled through its nakshatra at birth."""

    sub_periods: tuple[DashaPeriod, ...] = ()

    def contains(self, moment: datetime) -> bool:
        """Whether `moment` falls in this period.

        The start is inclusive and the end exclusive, so adjacent periods
        never both claim the same instant.
        """
        return self.start <= moment < self.end

    def active_at(self, moment: datetime) -> tuple[DashaPeriod, ...]:
        """This period and its active descendants at `moment`.

        Returns an empty tuple when `moment` lies outside this period, so the
        result reads as a lineage: Mahadasha, then Antardasha, and so on.
        """
        if not self.contains(moment):
            return ()

        for child in self.sub_periods:
            nested = child.active_at(moment)
            if nested:
                return (self, *nested)

        return (self,)


class DashaTimeline(BaseModel):
    """A complete Vimshottari timeline."""

    model_config = {"frozen": True}

    system: str = "vimshottari"

    moon_nakshatra: NakshatraPosition
    """The nakshatra the timeline is seeded from."""

    starting_lord: str
    """Lord of the Moon's nakshatra, who rules the first Mahadasha."""

    elapsed_fraction: float = Field(ge=0.0, le=1.0)
    """How far through its nakshatra the Moon had travelled at birth. This is
    what truncates the first period."""

    balance_years: float
    """Years of the first Mahadasha still remaining at birth."""

    periods: tuple[DashaPeriod, ...]

    year_length: DashaYearLength
    year_days: float

    uncertainty_days: float = 0.0
    """How far period boundaries could shift given the birth-time
    uncertainty. Zero for an exact birth time."""

    config: CalculationConfig
    moment: ResolvedBirthMoment

    def active_at(self, moment: datetime) -> tuple[DashaPeriod, ...]:
        """The lineage of periods active at `moment`, outermost first."""
        for period in self.periods:
            lineage = period.active_at(moment)
            if lineage:
                return lineage
        return ()

    @property
    def start(self) -> datetime:
        return self.periods[0].start

    @property
    def end(self) -> datetime:
        return self.periods[-1].end
