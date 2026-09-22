"""Transit (Gochar) routes."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Query, status

from app.api.errors import BIRTH_DATA_ERROR_RESPONSES
from app.api.schemas import (
    TransitReportRequest,
    TransitReportResponse,
    TransitSnapshotResponse,
)
from app.core.config import DEFAULT_CALCULATION_CONFIG
from app.services.astrology.transit.service import (
    calculate_transits,
    current_snapshot,
)

router = APIRouter(prefix="/transits", tags=["transits"])


@router.get(
    "",
    response_model=TransitSnapshotResponse,
    status_code=status.HTTP_200_OK,
    summary="Graha positions at a moment",
)
def get_transit_snapshot(
    at: datetime | None = Query(
        default=None,
        description=(
            "Moment to calculate for. Defaults to now. Naive values are read "
            "as UTC. Rounded down to the minute, which is what makes results "
            "reusable."
        ),
    ),
) -> TransitSnapshotResponse:
    """Where the grahas are, with no reference to anyone's birth chart.

    A genuine GET: the response depends only on the moment and the calculation
    configuration, contains no personal data, and is identical for every
    caller - so it is safely cacheable both here and downstream.

    For what these positions mean relative to a specific chart, use
    `POST /transits/vedic`.
    """
    return TransitSnapshotResponse(snapshot=current_snapshot(at))


@router.post(
    "/vedic",
    response_model=TransitReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Transits relative to a natal chart",
    responses=BIRTH_DATA_ERROR_RESPONSES,
)
def post_transit_report(request: TransitReportRequest) -> TransitReportResponse:
    """Relate current graha positions to a birth chart.

    Each transiting graha is reported twice over: as a bhava counted from the
    natal Ascendant, and as a bhava counted from the natal Moon's rashi, which
    is the traditional Gochar reference. Either may be unavailable
    independently - the Ascendant needs a birth time, the Moon's rashi needs
    the natal Moon to be certain - and whatever is missing is named in
    `report.unavailable`.

    Unlike the Dasha endpoint this accepts an unknown birth time: transiting
    positions depend on the present moment rather than the birth, so they stay
    exact and only the natal comparison is withheld.
    """
    config = request.config or DEFAULT_CALCULATION_CONFIG

    at = request.at
    if at is not None and at.tzinfo is None:
        at = at.replace(tzinfo=timezone.utc)

    return TransitReportResponse(
        report=calculate_transits(request.birth, at, config)
    )
