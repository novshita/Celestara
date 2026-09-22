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

    Both zodiac frames are available, but each is reached through its own
    explicitly named method - `sidereal_positions` or `tropical_positions`,
    never a shared method with a `sidereal=True` flag. A boolean is exactly
    how the two get mixed up: it defaults, it gets forgotten, and the result
    is off by the ayanamsa with nothing to show it. Naming the frame at every
    call site makes a Vedic service reaching for tropical data visible on the
    line where it happens.

    There is still no ayanamsa-subtraction helper. Converting between frames
    by hand caused a real 14-arcsecond error early in this project; the engine
    remains the only thing permitted to do it.
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

    def tropical_positions(
        self, jd_ut: float, bodies: tuple[str, ...]
    ) -> dict[str, BodyPosition]:
        """Tropical positions for the named bodies at a Julian Day (UT).

        The tropical zodiac is measured from the vernal equinox rather than
        the fixed stars, so these longitudes differ from the sidereal ones by
        the ayanamsa - currently about 24 degrees, nearly a whole sign. Only
        Western services may call this.
        """
        ...

    def tropical_houses(
        self, jd_ut: float, latitude: float, longitude: float
    ) -> HouseFrame:
        """Tropical house frame for a Julian Day (UT) and geographic position."""
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
