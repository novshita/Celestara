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

import time
from collections.abc import Callable, Sequence

from fastapi import APIRouter, Depends, Request, status

from app.api.deps import DbSession, OptionalUser
from app.api.errors import AI_CHAT_ERROR_RESPONSES
from app.api.schemas import ReadingRequest, ReadingResponse, TopicReadingRequest
from app.core.config import CalculationConfig
from app.db.models import User
from app.domain.ai import ExplanationDepth, ReadingTopic
from app.core.rate_limit import enforce_ai_rate_limit
from app.services.ai.audit import record_answer
from app.services.ai.service import (
    ReadingResult,
    current_model,
    generate_daily_reading,
    generate_monthly_reading,
    generate_topic_reading,
    generate_weekly_reading,
)
from app.services.memory.service import memories_for_prompt
from app.services.preferences.service import resolve

router = APIRouter(
    prefix="/readings",
    tags=["readings"],
    dependencies=[Depends(enforce_ai_rate_limit)],
)


Generator = Callable[[CalculationConfig, ExplanationDepth, Sequence[str]], ReadingResult]


def _respond(
    http_request: Request,
    db: DbSession,
    user: User | None,
    *,
    endpoint: str,
    depth: ExplanationDepth | None,
    config: CalculationConfig | None,
    generate: Generator,
) -> ReadingResponse:
    """What every reading route does around its own calculation: apply the
    caller's saved depth and configuration and the memories they chose to
    keep, generate, record how it was produced, and shape the response."""
    depth, config = resolve(db, user, depth, config)
    memories = [m.content for m in memories_for_prompt(db, user)]

    started = time.perf_counter()
    result = generate(config, depth, memories)
    latency_ms = int((time.perf_counter() - started) * 1000)

    record_answer(
        db,
        user,
        request_id=getattr(http_request.state, "request_id", "unknown"),
        endpoint=endpoint,
        intent=None,
        system="vedic",
        model=current_model(),
        depth=result.depth,
        factors=result.factors,
        safety_flags=result.safety_flags,
        latency_ms=latency_ms,
    )

    return ReadingResponse(
        reading=result.reading,
        model=current_model(),
        generated_for=result.generated_for,
        safety_flags=list(result.safety_flags),
        depth=result.depth,
        factors=result.factors,
    )


@router.post(
    "/daily",
    response_model=ReadingResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a daily reading grounded in today's transits",
    responses=AI_CHAT_ERROR_RESPONSES,
)
def daily_reading(
    request: ReadingRequest, http_request: Request, db: DbSession, user: OptionalUser
) -> ReadingResponse:
    """Calculate today's transits against the natal chart, then ask Claude
    for a short daily reading grounded in only those facts.

    Pass `topic` ("career today") to focus it on a life area. Follow-up
    questions go to the AI Guide, which keeps saved conversations for
    logged-in users.
    """
    return _respond(
        http_request,
        db,
        user,
        endpoint="daily",
        depth=request.depth,
        config=request.config,
        generate=lambda config, depth, memories: generate_daily_reading(
            request.birth, config, request.topic, depth, memories
        ),
    )


@router.post(
    "/weekly",
    response_model=ReadingResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a weekly reading grounded in the coming week's transits",
    responses=AI_CHAT_ERROR_RESPONSES,
)
def weekly_reading(
    request: ReadingRequest, http_request: Request, db: DbSession, user: OptionalUser
) -> ReadingResponse:
    """Calculate today's transits against the natal chart, then ask Claude
    for a short reading for the week ahead, grounded in today's positions and the changes
    calculated for the next 7 days.

    Pass `topic` to focus it on a life area.
    """
    return _respond(
        http_request,
        db,
        user,
        endpoint="weekly",
        depth=request.depth,
        config=request.config,
        generate=lambda config, depth, memories: generate_weekly_reading(
            request.birth, config, request.topic, depth, memories
        ),
    )


@router.post(
    "/monthly",
    response_model=ReadingResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a monthly reading grounded in the coming month's transits",
    responses=AI_CHAT_ERROR_RESPONSES,
)
def monthly_reading(
    request: ReadingRequest, http_request: Request, db: DbSession, user: OptionalUser
) -> ReadingResponse:
    """Calculate today's transits against the natal chart, then ask Claude
    for a short reading for the month ahead, grounded in today's positions and the changes
    calculated for the next 30 days.

    Pass `topic` to focus it on a life area.
    """
    return _respond(
        http_request,
        db,
        user,
        endpoint="monthly",
        depth=request.depth,
        config=request.config,
        generate=lambda config, depth, memories: generate_monthly_reading(
            request.birth, config, request.topic, depth, memories
        ),
    )


@router.post(
    "/topic/{topic}",
    response_model=ReadingResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a birth chart, career, love, relationships or growth reading",
    responses=AI_CHAT_ERROR_RESPONSES,
)
def topic_reading(
    topic: ReadingTopic,
    request: TopicReadingRequest,
    http_request: Request,
    db: DbSession,
    user: OptionalUser,
) -> ReadingResponse:
    """A category reading from product spec §13.

    `birth_chart` reads the natal chart alone (`generated_for` is null, as
    no transits are involved). `career`, `love`, `relationships` and
    `growth` read the natal chart with today's transits, focused on the
    bhavas and grahas traditionally tied to that life area.
    """
    return _respond(
        http_request,
        db,
        user,
        endpoint=f"topic:{topic.value}",
        depth=request.depth,
        config=request.config,
        generate=lambda config, depth, memories: generate_topic_reading(
            request.birth, topic, config, depth, memories
        ),
    )
