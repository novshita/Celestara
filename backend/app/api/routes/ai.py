"""The AI Guide: a single grounded question-and-answer turn."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status

from app.api.errors import AI_CHAT_ERROR_RESPONSES
from app.api.schemas import AiChatRequest, AiChatResponse
from app.core.config import DEFAULT_CALCULATION_CONFIG
from app.core.rate_limit import enforce_ai_rate_limit
from app.services.ai.service import answer_question, current_model

router = APIRouter(
    prefix="/ai", tags=["ai"], dependencies=[Depends(enforce_ai_rate_limit)]
)


@router.post(
    "/chat",
    response_model=AiChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask the AI Guide a question grounded in a calculated chart",
    responses=AI_CHAT_ERROR_RESPONSES,
)
def chat(request: AiChatRequest) -> AiChatResponse:
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
    config = request.config or DEFAULT_CALCULATION_CONFIG
    answer = answer_question(request.birth, request.system, request.question, config)
    return AiChatResponse(
        answer=answer, system_used=request.system, model=current_model()
    )
