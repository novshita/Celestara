"""Calculation configuration.

Engineering spec §8: calculation configuration must be explicit and never
buried in business logic. Every field here is something that changes chart
output, which means it also has to be recorded in chart metadata so a result
can be reproduced later (§10).
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class Ayanamsa(str, Enum):
    """Supported sidereal reference points."""

    LAHIRI = "lahiri"


class HouseSystem(str, Enum):
    """Supported bhava/house divisions.

    Vedic D1 uses whole-sign bhavas. The others exist because the Western
    service will need them and the engine boundary is shared.
    """

    WHOLE_SIGN = "whole_sign"
    PLACIDUS = "placidus"
    EQUAL = "equal"


class EphemerisSource(str, Enum):
    """Which ephemeris the engine must use.

    This is an explicit choice, not a preference. The Swiss Ephemeris library
    silently falls back to Moshier when `.se1` data files are absent, which
    would let chart output change between deployments without any code change.
    The adapter asserts that the source it got back is the source configured
    here.
    """

    #: Moshier analytic theory. Built into the library, no data files needed.
    #: Sub-arcsecond for our purposes and interpretively indistinguishable
    #: from SWISS at the resolution astrology works in (padas are 3°20').
    MOSHIER = "moshier"

    #: Swiss Ephemeris compressed data files. Requires `.se1` files on disk
    #: and an ephemeris path; see EPHEMERIS_PATH below.
    SWISS = "swiss"


class NodeType(str, Enum):
    """Rahu/Ketu calculation basis."""

    MEAN = "mean"
    TRUE = "true"


class DashaYearLength(str, Enum):
    """Which definition of "year" the Vimshottari periods are measured in.

    Traditions genuinely disagree, and the choice is not cosmetic: over a
    120-year cycle the options diverge by more than five years, so a period
    boundary can land in a different calendar year depending on this setting
    alone. It is therefore explicit configuration (engineering spec §8) and
    recorded in the timeline metadata.
    """

    JULIAN = "julian"
    """365.25 days. The most common choice in modern software."""

    SAVANA = "savana"
    """360 days. The traditional civil year used in several classical texts."""

    SIDEREAL = "sidereal"
    """365.256363 days - one orbit of Earth against the fixed stars, which is
    the frame the sidereal zodiac already uses."""


#: Days per year for each definition above.
DASHA_YEAR_DAYS: dict[DashaYearLength, float] = {
    DashaYearLength.JULIAN: 365.25,
    DashaYearLength.SAVANA: 360.0,
    DashaYearLength.SIDEREAL: 365.256363,
}


class CalculationConfig(BaseModel):
    """Explicit, versioned calculation settings.

    Immutable once a chart is calculated: the persisted chart stores the exact
    config used, so changing defaults here never silently rewrites history.
    """

    model_config = {"frozen": True}

    ayanamsa: Ayanamsa = Ayanamsa.LAHIRI
    house_system: HouseSystem = HouseSystem.WHOLE_SIGN
    ephemeris_source: EphemerisSource = EphemerisSource.MOSHIER
    node_type: NodeType = NodeType.MEAN

    dasha_year_length: DashaYearLength = DashaYearLength.JULIAN

    dasha_levels: int = Field(default=2, ge=1, le=4)
    """How deep to nest Dasha periods: 1 = Mahadasha only, 2 adds Antardasha,
    3 adds Pratyantardasha, 4 adds Sookshma. Each level multiplies the period
    count by nine, so 4 produces over 6500 periods - available for advanced
    users, but a poor default."""

    dasha_cycles: int = Field(default=1, ge=1, le=2)
    """How many 120-year cycles to generate. One covers any lifespan."""

    #: Filesystem path to Swiss Ephemeris `.se1` files. Required when
    #: ephemeris_source is SWISS, ignored otherwise.
    ephemeris_path: str | None = None

    #: Bumped whenever a change in this package alters numeric output for
    #: identical inputs. Stored alongside every chart so results stay
    #: explainable after the engine evolves.
    calculation_version: str = Field(default="1.0.0")


#: Defaults for users who have not configured anything. Beginners get these;
#: advanced users override per engineering spec §8.
DEFAULT_CALCULATION_CONFIG = CalculationConfig()
