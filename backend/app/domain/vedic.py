"""Vedic chart output schema.

Structured data only - no prose, no interpretation (engineering spec §6). The
AI layer consumes exactly this and is never handed raw birth data to work out
positions for itself.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.core.config import CalculationConfig
from app.domain.birth_data import ResolvedBirthMoment


class Certainty(BaseModel):
    """Whether a derived classification survives the birth-time uncertainty.

    With an unknown birth time the Moon can traverse most of a rashi, so
    "Moon in Taurus" may simply not be answerable. Saying so is required;
    guessing is not permitted (product spec §8).
    """

    model_config = {"frozen": True}

    rashi_certain: bool = True
    nakshatra_certain: bool = True
    pada_certain: bool = True

    @property
    def fully_certain(self) -> bool:
        return self.rashi_certain and self.nakshatra_certain and self.pada_certain


class NakshatraPosition(BaseModel):
    """A nakshatra placement with its pada and Vimshottari lord."""

    model_config = {"frozen": True}

    index: int = Field(ge=0, le=26)
    name: str
    pada: int = Field(ge=1, le=4)
    lord: str


class GrahaPlacement(BaseModel):
    """One graha's position in the D1 chart."""

    model_config = {"frozen": True}

    graha: str

    longitude: float = Field(ge=0.0, lt=360.0)
    """Sidereal ecliptic longitude in degrees."""

    rashi_index: int = Field(ge=0, le=11)
    rashi: str
    degrees_in_rashi: float = Field(ge=0.0, lt=30.0)

    nakshatra: NakshatraPosition

    retrograde: bool
    speed_longitude: float
    """Degrees per day. Rahu and Ketu are always retrograde by definition."""

    bhava: int | None = Field(default=None, ge=1, le=12)
    """Whole-sign bhava, 1-12. None when the birth time is unknown, because
    bhavas depend on the Ascendant."""

    certainty: Certainty = Certainty()

    derived_from: str | None = None
    """Set when the position is not calculated directly, e.g. Ketu from Rahu."""


class Bhava(BaseModel):
    """A whole-sign house."""

    model_config = {"frozen": True}

    number: int = Field(ge=1, le=12)
    rashi_index: int = Field(ge=0, le=11)
    rashi: str
    lord: str
    cusp_longitude: float = Field(ge=0.0, lt=360.0)
    grahas: tuple[str, ...] = ()


class Ascendant(BaseModel):
    """The Lagna."""

    model_config = {"frozen": True}

    longitude: float = Field(ge=0.0, lt=360.0)
    rashi_index: int = Field(ge=0, le=11)
    rashi: str
    degrees_in_rashi: float = Field(ge=0.0, lt=30.0)
    lord: str
    nakshatra: NakshatraPosition


class ChartMetadata(BaseModel):
    """Everything needed to explain or reproduce a chart (engineering spec §10)."""

    model_config = {"frozen": True}

    engine_id: str
    calculation_version: str
    config: CalculationConfig
    moment: ResolvedBirthMoment
    ayanamsa_degrees: float
    """The applied ayanamsa, for display and audit. Not a conversion factor -
    sidereal longitudes already have it applied by the engine."""

    unavailable: tuple[str, ...] = ()
    """Factors that could not be calculated, named so the UI and the AI can
    state the gap instead of filling it (engineering spec §29)."""


class VedicChart(BaseModel):
    """A complete Rashi (D1 / Janma Kundali) chart."""

    model_config = {"frozen": True}

    system: str = "vedic"
    zodiac: str = "sidereal"
    chart_type: str = "D1"

    placements: tuple[GrahaPlacement, ...]
    bhavas: tuple[Bhava, ...] = ()
    """Empty when the birth time is unknown."""

    ascendant: Ascendant | None = None
    """None when the birth time is unknown - never a fabricated default."""

    moon_nakshatra: NakshatraPosition | None = None
    """Surfaced directly because the Vimshottari Dasha timeline starts from it.
    None if the Moon's nakshatra is not certain."""

    metadata: ChartMetadata

    def placement(self, graha: str) -> GrahaPlacement:
        """Look up a single graha, raising if absent."""
        for item in self.placements:
            if item.graha == graha:
                return item
        raise KeyError(f"no placement for {graha!r} in this chart")
