"""Readings: AI-generated interpretation grounded in live calculated data.

A `POST`, not the `GET` the engineering spec's illustrative endpoint list
names - that list is explicitly "architectural examples, not immutable
contracts" (§18), and a birth record is request content, not something to
encode into a query string (and never into one that might be logged, per
§20's prohibition on birth data reaching logs).

All three periods below ground in the identical present-moment transit
snapshot rather than simulating transits across the period ahead - product
spec §13 requires current calculated data, not a static template, and
that's satisfied by reading today's configuration honestly rather than
pretending to forecast a week or month of planetary movement, which would
need a different, larger feature (sampling transits across a date range).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.api.errors import AI_CHAT_ERROR_RESPONSES
from app.api.schemas import ReadingRequest, ReadingResponse
from app.core.config import DEFAULT_CALCULATION_CONFIG
from app.core.rate_limit import enforce_ai_rate_limit
from app.services.ai.service import (
    current_model,
    generate_daily_reading,
    generate_monthly_reading,
    generate_weekly_reading,
)

router = APIRouter(
    prefix="/readings",
    tags=["readings"],
    dependencies=[Depends(enforce_ai_rate_limit)],
)


@router.post(
    "/daily",
    response_model=ReadingResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a daily reading grounded in today's transits",
    responses=AI_CHAT_ERROR_RESPONSES,
)
def daily_reading(request: ReadingRequest) -> ReadingResponse:
    """Calculate today's transits against the natal chart, then ask Claude
    for a short daily reading grounded in only those facts.

    This is the general daily reading only - topic selection ("career
    today") and follow-up questions are separate, later reading categories
    from product spec §13.
    """
    config = request.config or DEFAULT_CALCULATION_CONFIG
    result = generate_daily_reading(request.birth, config)
    return ReadingResponse(
        reading=result.reading,
        model=current_model(),
        generated_for=result.generated_for,
        safety_flags=list(result.safety_flags),
    )


@router.post(
    "/weekly",
    response_model=ReadingResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a weekly reading grounded in today's transits",
    responses=AI_CHAT_ERROR_RESPONSES,
)
def weekly_reading(request: ReadingRequest) -> ReadingResponse:
    """Calculate today's transits against the natal chart, then ask Claude
    for a short reading for the week ahead grounded in only those facts.

    This is the general weekly reading only - topic selection and
    follow-up questions are separate, later reading categories from
    product spec §13.
    """
    config = request.config or DEFAULT_CALCULATION_CONFIG
    result = generate_weekly_reading(request.birth, config)
    return ReadingResponse(
        reading=result.reading,
        model=current_model(),
        generated_for=result.generated_for,
        safety_flags=list(result.safety_flags),
    )


@router.post(
    "/monthly",
    response_model=ReadingResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a monthly reading grounded in today's transits",
    responses=AI_CHAT_ERROR_RESPONSES,
)
def monthly_reading(request: ReadingRequest) -> ReadingResponse:
    """Calculate today's transits against the natal chart, then ask Claude
    for a short reading for the month ahead grounded in only those facts.

    This is the general monthly reading only - topic selection and
    follow-up questions are separate, later reading categories from
    product spec §13.
    """
    config = request.config or DEFAULT_CALCULATION_CONFIG
    result = generate_monthly_reading(request.birth, config)
    return ReadingResponse(
        reading=result.reading,
        model=current_model(),
        generated_for=result.generated_for,
        safety_flags=list(result.safety_flags),
    )
