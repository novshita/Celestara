"""Shared astrology constants.

Pure data, no calculation and no engine dependency. Anything here is a
definition rather than a computed result.
"""

from __future__ import annotations

# --- Zodiac ----------------------------------------------------------------

RASHIS: tuple[str, ...] = (
    "Mesha",
    "Vrishabha",
    "Mithuna",
    "Karka",
    "Simha",
    "Kanya",
    "Tula",
    "Vrischika",
    "Dhanu",
    "Makara",
    "Kumbha",
    "Meena",
)

RASHI_WESTERN_NAMES: tuple[str, ...] = (
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

RASHI_LORDS: tuple[str, ...] = (
    "Mars",
    "Venus",
    "Mercury",
    "Moon",
    "Sun",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
    "Saturn",
    "Jupiter",
)

DEGREES_PER_RASHI = 30.0

# --- Nakshatras ------------------------------------------------------------

NAKSHATRAS: tuple[str, ...] = (
    "Ashwini",
    "Bharani",
    "Krittika",
    "Rohini",
    "Mrigashira",
    "Ardra",
    "Punarvasu",
    "Pushya",
    "Ashlesha",
    "Magha",
    "Purva Phalguni",
    "Uttara Phalguni",
    "Hasta",
    "Chitra",
    "Swati",
    "Vishakha",
    "Anuradha",
    "Jyeshtha",
    "Mula",
    "Purva Ashadha",
    "Uttara Ashadha",
    "Shravana",
    "Dhanishta",
    "Shatabhisha",
    "Purva Bhadrapada",
    "Uttara Bhadrapada",
    "Revati",
)

# The Vimshottari lord cycle repeats every 9 nakshatras. Kept here because it
# defines nakshatra identity; the Dasha timeline itself is a later feature.
NAKSHATRA_LORD_CYCLE: tuple[str, ...] = (
    "Ketu",
    "Venus",
    "Sun",
    "Moon",
    "Mars",
    "Rahu",
    "Jupiter",
    "Saturn",
    "Mercury",
)

NAKSHATRA_COUNT = 27
PADAS_PER_NAKSHATRA = 4
DEGREES_PER_NAKSHATRA = 360.0 / NAKSHATRA_COUNT  # 13 deg 20'
DEGREES_PER_PADA = DEGREES_PER_NAKSHATRA / PADAS_PER_NAKSHATRA  # 3 deg 20'

# --- Grahas ----------------------------------------------------------------

#: The Navagraha in traditional order. Ketu is derived from Rahu rather than
#: calculated, so it is not an engine body.
NAVAGRAHA: tuple[str, ...] = (
    "Sun",
    "Moon",
    "Mars",
    "Mercury",
    "Jupiter",
    "Venus",
    "Saturn",
    "Rahu",
    "Ketu",
)

#: Bodies whose longitude the ephemeris must supply directly.
CALCULATED_BODIES: tuple[str, ...] = NAVAGRAHA[:-1]


#: How close to an exact division boundary a scaled longitude must be before
#: it is treated as sitting *on* that boundary, in division units.
#:
#: Division boundaries are mostly unrepresentable in binary floating point:
#: 360/108 is 3.3333... so the 11th pada boundary evaluates to
#: 36.666666666666664, a hair *below* the true value, and naive truncation
#: assigns it to pada 3 instead of 4. Neither operand order fixes this - the
#: boundary itself cannot be expressed - so boundaries are snapped instead.
#:
#: 1e-9 division units is ~3e-9 degrees, or about 10 micro-arcseconds. That is
#: four orders of magnitude finer than the ephemeris itself resolves, so it
#: cannot reclassify a real position; it only makes exact boundaries behave
#: predictably.
_BOUNDARY_SNAP = 1e-9


def _division_index(longitude: float, divisions: int) -> int:
    """Return the 0-based index of `longitude` among `divisions` equal arcs."""
    scaled = (longitude % 360.0) * divisions / 360.0

    nearest = round(scaled)
    if abs(scaled - nearest) < _BOUNDARY_SNAP:
        scaled = float(nearest)

    return int(scaled) % divisions


def rashi_index(longitude: float) -> int:
    """Return the 0-based rashi index for a sidereal longitude."""
    return _division_index(longitude, 12)


def nakshatra_index(longitude: float) -> int:
    """Return the 0-based nakshatra index for a sidereal longitude."""
    return _division_index(longitude, NAKSHATRA_COUNT)


def pada_number(longitude: float) -> int:
    """Return the 1-based pada (1-4) within the nakshatra."""
    total_padas = NAKSHATRA_COUNT * PADAS_PER_NAKSHATRA
    absolute_pada = _division_index(longitude, total_padas)
    return absolute_pada % PADAS_PER_NAKSHATRA + 1


def nakshatra_lord(index: int) -> str:
    """Return the Vimshottari lord of a 0-based nakshatra index."""
    return NAKSHATRA_LORD_CYCLE[index % len(NAKSHATRA_LORD_CYCLE)]
