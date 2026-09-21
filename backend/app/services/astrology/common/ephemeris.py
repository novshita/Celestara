"""Ephemeris port.

Engineering spec §5 requires the calculation engine to sit behind a service
boundary. This module is that boundary: it defines what any engine must
provide, in plain values. Nothing above this line imports the engine library,
so swapping engines (or licences) touches one adapter and no domain code.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


class EphemerisError(RuntimeError):
    """Raised when the engine cannot satisfy the request as configured.

    Deliberately not recoverable by substituting an approximation: an
    unavailable calculation must surface rather than be quietly filled in
    (engineering spec §29).
    """


@dataclass(frozen=True, slots=True)
class BodyPosition:
    """A single body's position at one instant, in the sidereal frame."""

    body: str
    longitude: float
    """Sidereal ecliptic longitude in degrees, 0-360."""

    latitude: float
    """Ecliptic latitude in degrees."""

    distance_au: float

    speed_longitude: float
    """Daily motion in longitude, degrees/day. Negative means retrograde."""

    @property
    def is_retrograde(self) -> bool:
        return self.speed_longitude < 0.0


@dataclass(frozen=True, slots=True)
class HouseFrame:
    """Ascendant, Midheaven and cusps, all in the sidereal frame."""

    ascendant: float
    midheaven: float
    cusps: tuple[float, ...]
    """Twelve cusp longitudes, index 0 == 1st house."""

    def __post_init__(self) -> None:
        if len(self.cusps) != 12:
            raise EphemerisError(
                f"expected 12 house cusps, engine returned {len(self.cusps)}"
            )


@runtime_checkable
class EphemerisEngine(Protocol):
    """What the astrology services are allowed to ask an engine for.

    Every method returns sidereal values. There is no tropical accessor and no
    ayanamsa-subtraction helper, on purpose: mixing frames by hand is the
    single easiest way to introduce a silent offset, so the engine is the only
    thing permitted to convert between them.
    """

    @property
    def engine_id(self) -> str:
        """Stable identifier recorded in chart metadata for reproducibility."""
        ...

    def sidereal_positions(
        self, jd_ut: float, bodies: tuple[str, ...]
    ) -> dict[str, BodyPosition]:
        """Sidereal positions for the named bodies at a Julian Day (UT)."""
        ...

    def sidereal_houses(
        self, jd_ut: float, latitude: float, longitude: float
    ) -> HouseFrame:
        """Sidereal house frame for a Julian Day (UT) and geographic position."""
        ...

    def ayanamsa(self, jd_ut: float) -> float:
        """The ayanamsa actually applied, for display and audit only.

        Callers must not subtract this from anything. It is reported so a user
        can see which sidereal reference produced their chart.
        """
        ...

    def julian_day_ut(
        self, year: int, month: int, day: int, hour_fraction: float
    ) -> float:
        """Convert a UTC calendar moment to Julian Day (UT)."""
        ...
