"""Compare chart schema.

Structured data only, same as the Vedic and Western schemas it sits on top of
(engineering spec §6). Nothing here recomputes a position - it only describes
facts already present in the two independently-calculated charts, most
importantly the one number, the ayanamsa, that accounts for every disagreement
between them. Whether a difference "matters" is an interpretive question for
the AI layer (product spec §6); this module never answers it.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.domain.vedic import VedicChart
from app.domain.western import WesternChart


class SharedBodyComparison(BaseModel):
    """One body's placement in both systems, for the bodies both calculate.

    Rahu/Ketu (Vedic-only) and Uranus/Neptune/Pluto (Western-only, and
    omittable by configuration) are never compared - a comparison needs two
    sides.
    """

    model_config = {"frozen": True}

    body: str

    vedic_rashi: str
    vedic_degrees_in_rashi: float = Field(ge=0.0, lt=30.0)

    western_sign: str
    western_degrees_in_sign: float = Field(ge=0.0, lt=30.0)

    signs_apart: int = Field(ge=0, le=11)
    """How many signs ahead the Western sign is of the Vedic rashi, i.e. the
    ayanamsa's effect on this specific body. Usually 0 or 1 for a ~24 degree
    ayanamsa; 2 only for a body sitting within the ayanamsa's own width of a
    rashi boundary."""

    vedic_uncertain: bool = False
    """The Vedic rashi is not certain across the birth-time window."""

    western_uncertain: bool = False
    """The Western sign is not certain across the birth-time window."""


class AscendantComparison(BaseModel):
    """The Lagna against the Western Ascendant.

    None at the report level (not this model) when the birth time is unknown,
    since neither side has one to compare.
    """

    model_config = {"frozen": True}

    vedic_rashi: str
    western_sign: str
    signs_apart: int = Field(ge=0, le=11)


class ComparisonMetadata(BaseModel):
    """Enough to explain the comparison without re-deriving it."""

    model_config = {"frozen": True}

    ayanamsa_degrees: float
    """The sidereal offset. Every entry in `shared_bodies` and `ascendant`
    disagrees for exactly this reason and no other - engineering spec §16
    forbids the two calculation pipelines from merging, so nothing else could
    be the cause."""

    unavailable: tuple[str, ...] = ()
    """Comparison facets that could not be produced, e.g. `ascendant` when the
    birth time is unknown."""


class ChartComparison(BaseModel):
    """Both charts, plus the factual differences between them.

    Product spec §6: Compare is not a side-by-side viewer, it explains why the
    two calculations differ. This is the "why" - degrees and sign counts, not
    prose. The two full charts are included rather than just the diff, since a
    caller wanting to render Vedic and Western content side by side would
    otherwise have to fetch both endpoints again.
    """

    model_config = {"frozen": True}

    vedic: VedicChart
    western: WesternChart

    shared_bodies: tuple[SharedBodyComparison, ...]
    ascendant: AscendantComparison | None = None

    metadata: ComparisonMetadata
