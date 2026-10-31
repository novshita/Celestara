"""Planet exploration: everything about one planet in one chart."""

from __future__ import annotations

from fastapi import APIRouter, status

from app.api.errors import EXPLORE_ERROR_RESPONSES
from app.api.schemas import (
    PlanetAboutResponse,
    PlanetExplorationRequest,
    PlanetExplorationResponse,
)
from app.core.config import DEFAULT_CALCULATION_CONFIG
from app.services.exploration.service import explore_planet

router = APIRouter(prefix="/explore", tags=["explore"])


@router.post(
    "/planet",
    response_model=PlanetExplorationResponse,
    status_code=status.HTTP_200_OK,
    summary="Explore one planet in a chart",
    responses=EXPLORE_ERROR_RESPONSES,
)
def planet(request: PlanetExplorationRequest) -> PlanetExplorationResponse:
    """Where the planet is in the chart, what it is doing now (Vedic), the
    aspects it makes (Western), and the curated description of what it
    traditionally means.

    Everything here is calculated or curated - no model is involved, so it
    needs no account, is not rate limited, and gives the same answer every
    time. For an interpretation of how the planet reads in this chart, ask
    the AI Guide.
    """
    config = request.config or DEFAULT_CALCULATION_CONFIG
    result = explore_planet(request.birth, request.system, request.body, config)
    return PlanetExplorationResponse(
        system=result.system,
        body=result.body,
        placement=result.placement,
        transit=result.transit,
        position=result.position,
        aspects=result.aspects,
        about=(
            PlanetAboutResponse(
                id=result.about.id,
                title=result.about.title,
                version=result.about.version,
                text=result.about.body,
            )
            if result.about
            else None
        ),
    )
