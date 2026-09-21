"""Liveness route."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.schemas import HealthResponse
from app.core.config import DEFAULT_CALCULATION_CONFIG
from app.services.astrology.common.swisseph_engine import SwissEphemerisEngine

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse, summary="Liveness check")
def health() -> HealthResponse:
    """Report that the service is up and which engine it will calculate with.

    Constructing the engine here is deliberate: it fails fast if the
    configured ephemeris is unavailable, so a misconfigured deployment is
    visible from the health check rather than on a user's first chart request.
    """
    engine = SwissEphemerisEngine(DEFAULT_CALCULATION_CONFIG)
    return HealthResponse(
        status="ok",
        calculation_version=DEFAULT_CALCULATION_CONFIG.calculation_version,
        engine_id=engine.engine_id,
    )
