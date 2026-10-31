"""Planet exploration (product spec §11-12: "interactive planet exploration").

Everything the application knows about one planet in one chart, gathered in
one place so a client can show a planet's page without stitching together
several calls: where it is in the chart, what it is doing now, and the
curated description of what it traditionally means. All of it is calculated
or curated; nothing here asks a model.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.core.config import DEFAULT_CALCULATION_CONFIG, CalculationConfig
from app.domain.birth_data import BirthData
from app.domain.transit import GrahaTransit
from app.domain.vedic import GrahaPlacement
from app.domain.western import Aspect, PlanetPosition
from app.services.astrology.transit.service import calculate_transits
from app.services.astrology.vedic.d1 import calculate_d1_chart
from app.services.astrology.western.chart import calculate_western_chart
from app.services.knowledge.loader import KnowledgeEntry, get_entry


class UnknownBodyError(ValueError):
    """The chart has no planet by this name - a typo, or an outer planet in a
    configuration that leaves them out."""


@dataclass(frozen=True)
class PlanetExploration:
    system: str
    body: str
    placement: GrahaPlacement | None = None
    """Vedic only: the graha's place in the D1 chart."""
    position: PlanetPosition | None = None
    """Western only: the planet's place in the tropical chart."""
    aspects: tuple[Aspect, ...] = ()
    """Western only: every aspect this planet makes."""
    transit: GrahaTransit | None = None
    """Vedic only: where the graha is now, against the natal chart."""
    about: KnowledgeEntry | None = None
    """The curated description of the planet."""


def _find(name: str, candidates: list[str]) -> str:
    wanted = name.strip().lower()
    for candidate in candidates:
        if candidate.lower() == wanted:
            return candidate
    raise UnknownBodyError(f"no body named {name!r} in this chart")


def explore_planet(
    birth: BirthData,
    system: str,
    body: str,
    config: CalculationConfig = DEFAULT_CALCULATION_CONFIG,
) -> PlanetExploration:
    if system == "western":
        chart = calculate_western_chart(birth, config)
        name = _find(body, [p.body for p in chart.positions])
        return PlanetExploration(
            system="western",
            body=name,
            position=chart.position(name),
            aspects=chart.aspects_for(name),
            about=get_entry(f"western-planet-{name.lower()}"),
        )

    chart = calculate_d1_chart(birth, config)
    name = _find(body, [p.graha for p in chart.placements])
    return PlanetExploration(
        system="vedic",
        body=name,
        placement=chart.placement(name),
        transit=calculate_transits(birth, config=config).transit_of(name),
        about=get_entry(f"vedic-graha-{name.lower()}"),
    )
