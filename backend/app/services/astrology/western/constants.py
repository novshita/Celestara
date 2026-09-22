"""Western astrology constants.

Deliberately separate from the Vedic constants. Engineering spec §16 requires
the two systems' rules to stay unmerged, and sharing a constants module is how
they would start to blend - a "sign" means a different span of sky in each.
"""

from __future__ import annotations

from typing import NamedTuple

#: Tropical signs, in order from the vernal equinox.
SIGNS: tuple[str, ...] = (
    "Aries",
    "Taurus",
    "Gemini",
    "Cancer",
    "Leo",
    "Virgo",
    "Libra",
    "Scorpio",
    "Sagittarius",
    "Capricorn",
    "Aquarius",
    "Pisces",
)

SIGN_RULERS: tuple[str, ...] = (
    "Mars",
    "Venus",
    "Mercury",
    "Moon",
    "Sun",
    "Mercury",
    "Venus",
    "Pluto",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
)
"""Modern rulerships, which assign the outer planets to Scorpio, Aquarius and
Pisces. Traditional rulership gives those to Mars, Saturn and Jupiter; if
traditional rulers are ever needed they belong in a second table rather than
replacing this one."""

DEGREES_PER_SIGN = 30.0

#: Elements and modalities, indexed by sign. Both cycle regularly, but are
#: written out rather than computed so the tables are readable and greppable.
SIGN_ELEMENTS: tuple[str, ...] = (
    "Fire", "Earth", "Air", "Water",
    "Fire", "Earth", "Air", "Water",
    "Fire", "Earth", "Air", "Water",
)

SIGN_MODALITIES: tuple[str, ...] = (
    "Cardinal", "Fixed", "Mutable",
    "Cardinal", "Fixed", "Mutable",
    "Cardinal", "Fixed", "Mutable",
    "Cardinal", "Fixed", "Mutable",
)

#: The seven classical bodies, shared with Jyotish though under other names.
CLASSICAL_BODIES: tuple[str, ...] = (
    "Sun",
    "Moon",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
)

#: Discovered after the telescope, and optional per configuration.
OUTER_BODIES: tuple[str, ...] = ("Uranus", "Neptune", "Pluto")


class AspectDefinition(NamedTuple):
    """A major aspect: an angular relationship between two bodies."""

    name: str
    angle: float
    uses_tight_orb: bool = False


#: The five Ptolemaic aspects. Minor aspects (quincunx, semi-sextile and the
#: rest) are a later feature; V1 covers the major ones per product spec §5.
MAJOR_ASPECTS: tuple[AspectDefinition, ...] = (
    AspectDefinition("Conjunction", 0.0),
    AspectDefinition("Sextile", 60.0, uses_tight_orb=True),
    AspectDefinition("Square", 90.0),
    AspectDefinition("Trine", 120.0),
    AspectDefinition("Opposition", 180.0),
)

#: Aspects traditionally read as harmonious or as tense. Included because the
#: interpretation layer will want it, and kept as data rather than as a
#: judgement baked into the calculation.
HARMONIOUS_ASPECTS: frozenset[str] = frozenset({"Trine", "Sextile"})
CHALLENGING_ASPECTS: frozenset[str] = frozenset({"Square", "Opposition"})


def sign_index(longitude: float) -> int:
    """0-based tropical sign index for a longitude.

    Multiplies before dividing for the same reason the Vedic classifier does:
    a fractional span makes exact boundaries fall into the previous sign.
    """
    return int((longitude % 360.0) * 12.0 / 360.0) % 12


def western_bodies(include_outer: bool) -> tuple[str, ...]:
    """The body set for a Western chart."""
    return CLASSICAL_BODIES + (OUTER_BODIES if include_outer else ())
