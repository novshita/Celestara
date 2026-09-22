"""Transit (Gochar) schema.

Two distinct things live here, and keeping them apart matters:

A *snapshot* is where the grahas are at some moment. It contains no personal
data at all, which is what makes it cacheable and shareable across users
(engineering spec §28).

A *report* relates that snapshot to one person's natal chart. It is personal
data and must never be cached across users.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.core.config import CalculationConfig
from app.domain.vedic import NakshatraPosition


class TransitPosition(BaseModel):
    """Where one graha is at a moment."""

    model_config = {"frozen": True}

    graha: str

    longitude: float = Field(ge=0.0, lt=360.0)
    rashi_index: int = Field(ge=0, le=11)
    rashi: str
    degrees_in_rashi: float = Field(ge=0.0, lt=30.0)

    nakshatra: NakshatraPosition

    retrograde: bool
    speed_longitude: float

    derived_from: str | None = None


class TransitSnapshot(BaseModel):
    """Graha positions at one instant, independent of any birth chart.

    Contains no personal data, so it is safe to cache and reuse.
    """

    model_config = {"frozen": True}

    moment: datetime
    """The instant these positions were calculated for, in UTC.

    This is the *quantised* moment, not necessarily the one requested - see
    `granularity_seconds`. Reporting the quantised value keeps the positions
    and the timestamp consistent with each other.
    """

    julian_day_ut: float

    granularity_seconds: int
    """Resolution the request was rounded to before calculating, which is what
    makes snapshots reusable. The fastest body, the Moon, moves about 0.5
    arcseconds per second, so a one-minute resolution costs well under an
    arcminute of accuracy."""

    positions: tuple[TransitPosition, ...]

    engine_id: str
    calculation_version: str
    config: CalculationConfig

    def position(self, graha: str) -> TransitPosition:
        for item in self.positions:
            if item.graha == graha:
                return item
        raise KeyError(f"no transit position for {graha!r}")


class GrahaTransit(BaseModel):
    """One transiting graha, related to a natal chart."""

    model_config = {"frozen": True}

    graha: str
    transit: TransitPosition

    natal_longitude: float
    natal_rashi: str

    bhava_from_ascendant: int | None = Field(default=None, ge=1, le=12)
    """Which natal bhava the graha is currently crossing. None when the birth
    time is unknown, since bhavas depend on the Ascendant."""

    bhava_from_moon: int | None = Field(default=None, ge=1, le=12)
    """The same count taken from the natal Moon's rashi (Chandra Lagna), which
    is the traditional reference for Gochar. None when the natal Moon's rashi
    is not certain."""

    in_natal_rashi: bool
    """True when the graha has returned to the rashi it occupied at birth."""

    separation_from_natal: float = Field(ge=0.0, le=180.0)
    """Shortest angular distance from its own natal position, in degrees."""


class TransitReport(BaseModel):
    """A snapshot related to one person's chart. Personal data."""

    model_config = {"frozen": True}

    snapshot: TransitSnapshot
    transits: tuple[GrahaTransit, ...]

    natal_ascendant_rashi: str | None = None
    natal_moon_rashi: str | None = None

    unavailable: tuple[str, ...] = ()
    """Relationships that could not be derived, named so the UI and the AI
    state the gap rather than filling it (engineering spec §29)."""

    def transit_of(self, graha: str) -> GrahaTransit:
        for item in self.transits:
            if item.graha == graha:
                return item
        raise KeyError(f"no transit for {graha!r}")
