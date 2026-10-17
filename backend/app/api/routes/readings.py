"""Readings: AI-generated interpretation grounded in live calculated data.

A `POST`, not the `GET` the engineering spec's illustrative endpoint list
names - that list is explicitly "architectural examples, not immutable
contracts" (§18), and a birth record is request content, not something to
encode into a query string (and never into one that might be logged, per
§20's prohibition on birth data reaching logs).
"""

from __future__ import annotations

from fastapi import APIRouter, status

from app.api.errors import AI_CHAT_ERROR_RESPONSES
from app.api.schemas import DailyReadingRequest, DailyReadingResponse
from app.core.config import DEFAULT_CALCULATION_CONFIG
from app.services.ai.service import current_model, generate_daily_reading

router = APIRouter(prefix="/readings", tags=["readings"])


@router.post(
    "/daily",
    response_model=DailyReadingResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a daily reading grounded in today's transits",
    responses=AI_CHAT_ERROR_RESPONSES,
)
def daily_reading(request: DailyReadingRequest) -> DailyReadingResponse:
    """Calculate today's transits against the natal chart, then ask Claude
    for a short reading grounded in only those facts.

    Product spec §13: "Daily readings use current calculated
    planetary/transit data" and must not fall back to a static template.
    This is the general reading only - topic selection ("career today",
    "love today") and follow-up questions are separate, later reading
    categories from the same spec section.
    """
    config = request.config or DEFAULT_CALCULATION_CONFIG
    reading, generated_for = generate_daily_reading(request.birth, config)
    return DailyReadingResponse(
        reading=reading, model=current_model(), generated_for=generated_for
    )
