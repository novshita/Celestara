"""Readings: AI-generated interpretation grounded in live calculated data.

A `POST`, not the `GET` the engineering spec's illustrative endpoint list
names - that list is explicitly "architectural examples, not immutable
contracts" (§18), and a birth record is request content, not something to
encode into a query string (and never into one that might be logged, per
§20's prohibition on birth data reaching logs).

The daily reading grounds in today's transit snapshot. The weekly and
monthly ones also look ahead - 7 and 30 days - for the rashi changes and
retrograde/direct turns that actually fall in the period, so product spec
§13's "current calculated data" holds for them too rather than restating
today's sky.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.api.errors import AI_CHAT_ERROR_RESPONSES
from app.api.schemas import ReadingRequest, ReadingResponse, TopicReadingRequest
from app.core.config import DEFAULT_CALCULATION_CONFIG
from app.domain.ai import ReadingTopic
from app.core.rate_limit import enforce_ai_rate_limit
from app.services.ai.service import (
    current_model,
    generate_daily_reading,
    generate_monthly_reading,
    generate_topic_reading,
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

    Pass `topic` ("career today") to focus it on a life area. Follow-up
    questions are a separate, later feature.
    """
    config = request.config or DEFAULT_CALCULATION_CONFIG
    result = generate_daily_reading(request.birth, config, request.topic)
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
    summary="Generate a weekly reading grounded in the coming week's transits",
    responses=AI_CHAT_ERROR_RESPONSES,
)
def weekly_reading(request: ReadingRequest) -> ReadingResponse:
    """Calculate today's transits against the natal chart, then ask Claude
    for a short reading for the week ahead, grounded in today's positions and the changes
    calculated for the next 7 days.

    Pass `topic` to focus it on a life area.
    """
    config = request.config or DEFAULT_CALCULATION_CONFIG
    result = generate_weekly_reading(request.birth, config, request.topic)
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
    summary="Generate a monthly reading grounded in the coming month's transits",
    responses=AI_CHAT_ERROR_RESPONSES,
)
def monthly_reading(request: ReadingRequest) -> ReadingResponse:
    """Calculate today's transits against the natal chart, then ask Claude
    for a short reading for the month ahead, grounded in today's positions and the changes
    calculated for the next 30 days.

    Pass `topic` to focus it on a life area.
    """
    config = request.config or DEFAULT_CALCULATION_CONFIG
    result = generate_monthly_reading(request.birth, config, request.topic)
    return ReadingResponse(
        reading=result.reading,
        model=current_model(),
        generated_for=result.generated_for,
        safety_flags=list(result.safety_flags),
    )


@router.post(
    "/topic/{topic}",
    response_model=ReadingResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a birth chart, career, love, relationships or growth reading",
    responses=AI_CHAT_ERROR_RESPONSES,
)
def topic_reading(topic: ReadingTopic, request: TopicReadingRequest) -> ReadingResponse:
    """A category reading from product spec §13.

    `birth_chart` reads the natal chart alone (`generated_for` is null, as
    no transits are involved). `career`, `love`, `relationships` and
    `growth` read the natal chart with today's transits, focused on the
    bhavas and grahas traditionally tied to that life area.
    """
    config = request.config or DEFAULT_CALCULATION_CONFIG
    result = generate_topic_reading(request.birth, topic, config)
    return ReadingResponse(
        reading=result.reading,
        model=current_model(),
        generated_for=result.generated_for,
        safety_flags=list(result.safety_flags),
    )
