"""Dasha timeline routes."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, status

from app.api.errors import DASHA_ERROR_RESPONSES
from app.api.schemas import VimshottariRequest, VimshottariResponse
from app.core.config import DEFAULT_CALCULATION_CONFIG
from app.services.astrology.vedic.dasha import calculate_vimshottari

router = APIRouter(prefix="/dashas", tags=["dashas"])


@router.post(
    "/vimshottari",
    response_model=VimshottariResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate a Vimshottari Dasha timeline",
    responses=DASHA_ERROR_RESPONSES,
)
def calculate_vimshottari_timeline(
    request: VimshottariRequest,
) -> VimshottariResponse:
    """Calculate the 120-year Vimshottari timeline for a birth record.

    The timeline is seeded from the Moon's position within its nakshatra,
    which fixes both the first ruling lord and how much of that period had
    already elapsed at birth.

    Unlike the chart endpoint, this one **requires** a birth time: without it
    the Moon's nakshatra is undetermined, and a different nakshatra means a
    different lord and a different 120-year sequence. Such a request returns
    422 with code `UNKNOWN_BIRTH_TIME`.

    `active_now` reports the period lineage in effect at request time, so a
    caller does not have to search the timeline itself.
    """
    config = request.config or DEFAULT_CALCULATION_CONFIG
    timeline = calculate_vimshottari(request.birth, config)

    as_of = request.as_of or datetime.now(timezone.utc)
    if as_of.tzinfo is None:
        as_of = as_of.replace(tzinfo=timezone.utc)

    return VimshottariResponse(
        timeline=timeline,
        as_of=as_of,
        active_now=timeline.active_at(as_of),
    )
