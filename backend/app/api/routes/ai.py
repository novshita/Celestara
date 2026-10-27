"""The AI Guide: a single grounded question-and-answer turn."""

from __future__ import annotations

from fastapi import APIRouter, Request, status

from app.api.errors import AI_CHAT_ERROR_RESPONSES
from app.api.schemas import AiChatRequest, AiChatResponse
from app.core.config import DEFAULT_CALCULATION_CONFIG
from app.core.rate_limit import enforce_ai_rate_limit
from app.services.ai.safety import assess_question
from app.services.ai.service import answer_question, current_model

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post(
    "/chat",
    response_model=AiChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask the AI Guide a question grounded in a calculated chart",
    responses=AI_CHAT_ERROR_RESPONSES,
)
def chat(request: AiChatRequest, http_request: Request) -> AiChatResponse:
    """Calculate the requested chart system, then ask Claude to answer the
    question using only those calculated facts.

    Product spec §1: "The system calculates. The AI interprets. The user
    decides." The calculation happens exactly as it would for the matching
    `/charts/*` endpoint; the model never computes a position, house, or
    aspect itself, only interprets the ones it is given.

    This is a single turn, not a conversation - no history is read or
    stored. A 503 (`AI_UNAVAILABLE`) means the AI provider itself could not
    be reached; everything else is the same birth-data validation the
    chart endpoints already enforce.
    """
    # Enforced here rather than as a router dependency, after the crisis
    # check: a crisis is answered with fixed text, costs nothing, and must
    # never come back as "too many requests" to someone in distress - which
    # would be possible, since callers share an allowance until the frontend
    # forwards per-user addresses. Everything else is limited as before.
    if not assess_question(request.question).crisis:
        enforce_ai_rate_limit(http_request)

    config = request.config or DEFAULT_CALCULATION_CONFIG
    result = answer_question(request.birth, request.system, request.question, config)
    return AiChatResponse(
        answer=result.answer,
        system_used=request.system,
        model=current_model() if result.model_used else None,
        intent=result.intent,
        notice=result.notice,
        safety_flags=list(result.safety_flags),
    )
