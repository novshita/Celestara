"""Western chart schema.

Kept structurally separate from the Vedic schema even where fields look alike.
A "sign" here is a tropical sign measured from the vernal equinox, and a
"house" is whatever the configured division produces - neither is the same
object as a rashi or a bhava, and a shared type would invite treating them as
interchangeable.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.core.config import CalculationConfig
from app.domain.birth_data import ResolvedBirthMoment


class PlanetPosition(BaseModel):
    """One body's position in the tropical zodiac."""

    model_config = {"frozen": True}

    body: str

    longitude: float = Field(ge=0.0, lt=360.0)
    sign_index: int = Field(ge=0, le=11)
    sign: str
    degrees_in_sign: float = Field(ge=0.0, lt=30.0)

    element: str
    modality: str

    retrograde: bool
    speed_longitude: float

    house: int | None = Field(default=None, ge=1, le=12)
    """Which house the body occupies. None when the birth time is unknown,
    since houses depend on the Ascendant."""

    uncertain: bool = False
    """True when the birth-time uncertainty leaves the sign in doubt."""


class House(BaseModel):
    """One house, spanning from its own cusp to the next."""

    model_config = {"frozen": True}

    number: int = Field(ge=1, le=12)

    cusp_longitude: float = Field(ge=0.0, lt=360.0)
    sign_index: int = Field(ge=0, le=11)
    sign: str
    ruler: str

    size_degrees: float = Field(gt=0.0, lt=360.0)
    """Houses are equal only in some systems. Placidus produces unequal
    houses, markedly so at high latitudes, so the span is reported rather
    than assumed to be 30 degrees."""

    bodies: tuple[str, ...] = ()


class Aspect(BaseModel):
    """An angular relationship between two bodies."""

    model_config = {"frozen": True}

    first: str
    second: str

    aspect: str
    exact_angle: float
    """The angle this aspect is defined by, e.g. 90 for a square."""

    separation: float = Field(ge=0.0, le=180.0)
    """The actual angular distance between the two bodies."""

    orb: float
    """How far from exact the aspect is. Signed: negative means the bodies are
    closer together than the exact angle, positive means further apart."""

    applying: bool
    """True when the aspect is tightening toward exact, false when it is
    separating. Derived from the bodies' relative motion."""

    harmonious: bool | None = None
    """Traditional reading, where one exists. Conjunctions are neither, so
    this is None for them - the meaning depends on which bodies are involved,
    which is interpretation rather than calculation."""


class Angles(BaseModel):
    """The chart angles.

    Only available with a birth time: all four depend on the Earth's rotation
    at the birth moment, not merely the date.
    """

    model_config = {"frozen": True}

    ascendant: float = Field(ge=0.0, lt=360.0)
    ascendant_sign: str
    ascendant_degrees: float = Field(ge=0.0, lt=30.0)
    ascendant_ruler: str

    midheaven: float = Field(ge=0.0, lt=360.0)
    midheaven_sign: str

    descendant: float = Field(ge=0.0, lt=360.0)
    imum_coeli: float = Field(ge=0.0, lt=360.0)


class WesternChartMetadata(BaseModel):
    """Everything needed to explain or reproduce the chart."""

    model_config = {"frozen": True}

    engine_id: str
    calculation_version: str
    config: CalculationConfig
    moment: ResolvedBirthMoment

    house_system: str
    bodies_included: tuple[str, ...]

    unavailable: tuple[str, ...] = ()


class WesternChart(BaseModel):
    """A complete Western natal chart."""

    model_config = {"frozen": True}

    system: str = "western"
    zodiac: str = "tropical"

    positions: tuple[PlanetPosition, ...]
    houses: tuple[House, ...] = ()
    """Empty when the birth time is unknown."""

    angles: Angles | None = None
    """None when the birth time is unknown - never a fabricated default."""

    aspects: tuple[Aspect, ...] = ()

    metadata: WesternChartMetadata

    def position(self, body: str) -> PlanetPosition:
        for item in self.positions:
            if item.body == body:
                return item
        raise KeyError(f"no position for {body!r} in this chart")

    def aspects_for(self, body: str) -> tuple[Aspect, ...]:
        """Every aspect involving `body`."""
        return tuple(
            aspect
            for aspect in self.aspects
            if body in (aspect.first, aspect.second)
        )
