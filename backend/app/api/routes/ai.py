"""The AI Guide: a grounded question-and-answer turn, saved as a
conversation for logged-in users."""

from __future__ import annotations

import time

from fastapi import APIRouter, Request, status

from app.api.deps import DbSession, OptionalUser
from app.api.errors import AI_CHAT_ERROR_RESPONSES
from app.api.schemas import AiChatRequest, AiChatResponse
from app.core.rate_limit import enforce_ai_rate_limit
from app.services.ai.audit import record_answer
from app.services.ai.safety import assess_question
from app.services.ai.service import answer_question, current_model
from app.services.auth.service import InvalidSessionError
from app.services.conversations.service import (
    get_conversation,
    history_for_prompt,
    record_exchange,
    start_conversation,
)
from app.services.memory.service import memories_for_prompt
from app.services.preferences.service import resolve

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post(
    "/chat",
    response_model=AiChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask the AI Guide a question grounded in a calculated chart",
    responses=AI_CHAT_ERROR_RESPONSES,
)
def chat(
    request: AiChatRequest,
    http_request: Request,
    db: DbSession,
    user: OptionalUser,
) -> AiChatResponse:
    """Calculate the requested chart system, then ask Claude to answer the
    question using only those calculated facts.

    Product spec §1: "The system calculates. The AI interprets. The user
    decides." The calculation happens exactly as it would for the matching
    `/charts/*` endpoint; the model never computes a position, house, or
    aspect itself, only interprets the ones it is given.

    Works without an account, statelessly. With a bearer token it also uses
    the user's saved explanation depth and calculation configuration and the
    memories they chose to keep, and saves the exchange as a conversation
    that a follow-up can continue (`conversation_id`). A 503
    (`AI_UNAVAILABLE`) means the AI provider itself could not be reached;
    everything else is the same birth-data validation the chart endpoints
    already enforce.
    """
    conversation = None
    if request.conversation_id is not None:
        if user is None:
            raise InvalidSessionError("a conversation needs a logged-in user")
        conversation = get_conversation(db, user, request.conversation_id)

    # Enforced here rather than as a router dependency, after the crisis
    # check: a crisis is answered with fixed text, costs nothing, and must
    # never come back as "too many requests" to someone in distress - which
    # would be possible, since callers share an allowance until the frontend
    # forwards per-user addresses. Everything else is limited as before.
    if not assess_question(request.question).crisis:
        enforce_ai_rate_limit(http_request)

    depth, config = resolve(db, user, request.depth, request.config)
    memories = [m.content for m in memories_for_prompt(db, user)]
    history = history_for_prompt(conversation) if conversation is not None else []

    started = time.perf_counter()
    result = answer_question(
        request.birth,
        request.system,
        request.question,
        config,
        depth=depth,
        memories=memories,
        history=history,
    )
    latency_ms = int((time.perf_counter() - started) * 1000)

    # Only an answer the model actually wrote is saved: a crisis message is
    # never kept, and a declined off-topic request is not worth a place in
    # someone's history.
    conversation_id = None
    if user is not None and result.model_used:
        if conversation is None:
            conversation = start_conversation(db, user, request.question)
        record_exchange(db, conversation, request.question, result.answer)
        conversation_id = conversation.id

    record_answer(
        db,
        user,
        request_id=getattr(http_request.state, "request_id", "unknown"),
        endpoint="chat",
        intent=result.intent.value,
        system=request.system,
        model=current_model() if result.model_used else None,
        depth=result.depth,
        factors=result.factors,
        safety_flags=result.safety_flags,
        latency_ms=latency_ms,
    )

    return AiChatResponse(
        answer=result.answer,
        system_used=request.system,
        model=current_model() if result.model_used else None,
        intent=result.intent,
        notice=result.notice,
        safety_flags=list(result.safety_flags),
        depth=result.depth,
        conversation_id=conversation_id,
        factors=result.factors,
    )
