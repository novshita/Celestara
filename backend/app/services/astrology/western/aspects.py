"""Aspect detection.

An aspect is a specific angular distance between two bodies - 90 degrees for a
square, 120 for a trine - allowed some tolerance, called the orb. Whether the
aspect is tightening or loosening also matters, and that is decided by the two
bodies' relative motion rather than by their positions alone.
"""

from __future__ import annotations

from app.core.config import CalculationConfig
from app.domain.western import Aspect
from app.services.astrology.common.ephemeris import BodyPosition

from .constants import (
    CHALLENGING_ASPECTS,
    HARMONIOUS_ASPECTS,
    MAJOR_ASPECTS,
    AspectDefinition,
)

#: Look-ahead used to decide whether an aspect is applying or separating.
#: Short enough that linear extrapolation from the bodies' current speeds
#: holds, long enough that the slowest pair still moves measurably.
_LOOKAHEAD_DAYS = 1.0


def separation(first: float, second: float) -> float:
    """Shortest angular distance between two longitudes, 0-180 degrees."""
    delta = abs((first - second) % 360.0)
    return min(delta, 360.0 - delta)


def _orb_allowance(definition: AspectDefinition, config: CalculationConfig) -> float:
    return (
        config.sextile_orb_degrees
        if definition.uses_tight_orb
        else config.aspect_orb_degrees
    )


def _is_applying(
    first: BodyPosition, second: BodyPosition, exact_angle: float
) -> bool:
    """Whether the pair is moving toward the exact angle.

    Decided by extrapolating both bodies forward a day at their current
    speeds and seeing whether the orb shrank. Using relative speed directly
    would need separate handling for each side of exactness and for retrograde
    motion; extrapolating gets all of those right by construction.
    """
    current = abs(separation(first.longitude, second.longitude) - exact_angle)

    later = abs(
        separation(
            first.longitude + first.speed_longitude * _LOOKAHEAD_DAYS,
            second.longitude + second.speed_longitude * _LOOKAHEAD_DAYS,
        )
        - exact_angle
    )

    return later < current


def _harmonious(aspect_name: str) -> bool | None:
    if aspect_name in HARMONIOUS_ASPECTS:
        return True
    if aspect_name in CHALLENGING_ASPECTS:
        return False
    return None


def find_aspects(
    positions: dict[str, BodyPosition],
    bodies: tuple[str, ...],
    config: CalculationConfig,
) -> tuple[Aspect, ...]:
    """Every major aspect among `bodies`, tightest first.

    Each pair is considered once. Where a pair is within orb of more than one
    aspect - only possible with very wide orbs - the closest to exact wins,
    since reporting both would imply two simultaneous relationships that
    practitioners would not read.
    """
    found: list[Aspect] = []

    for index, first_name in enumerate(bodies):
        for second_name in bodies[index + 1 :]:
            first = positions[first_name]
            second = positions[second_name]

            distance = separation(first.longitude, second.longitude)

            best: tuple[float, AspectDefinition] | None = None
            for definition in MAJOR_ASPECTS:
                orb = distance - definition.angle
                if abs(orb) <= _orb_allowance(definition, config):
                    if best is None or abs(orb) < abs(best[0]):
                        best = (orb, definition)

            if best is None:
                continue

            orb, definition = best
            found.append(
                Aspect(
                    first=first_name,
                    second=second_name,
                    aspect=definition.name,
                    exact_angle=definition.angle,
                    separation=distance,
                    orb=orb,
                    applying=_is_applying(first, second, definition.angle),
                    harmonious=_harmonious(definition.name),
                )
            )

    # Tightest orb first: the closer to exact, the stronger the aspect is
    # traditionally held to be, so this is the order a reader wants.
    return tuple(sorted(found, key=lambda aspect: abs(aspect.orb)))
