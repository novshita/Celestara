"""Saved AI Guide conversations: list, read, delete one, delete all."""

from __future__ import annotations

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.api.errors import AUTH_REQUIRED_RESPONSES, CONVERSATION_ERROR_RESPONSES
from app.api.schemas import (
    ConversationDetailResponse,
    ConversationListResponse,
    ConversationSummaryResponse,
)
from app.services.conversations.service import (
    delete_all_conversations,
    delete_conversation,
    get_conversation,
    list_conversations,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get(
    "",
    response_model=ConversationListResponse,
    summary="List saved conversations, newest first",
    responses=AUTH_REQUIRED_RESPONSES,
)
def read_conversations(user: CurrentUser, db: DbSession) -> ConversationListResponse:
    return ConversationListResponse(
        conversations=tuple(
            ConversationSummaryResponse.model_validate(c)
            for c in list_conversations(db, user)
        )
    )


@router.get(
    "/{conversation_id}",
    response_model=ConversationDetailResponse,
    summary="Read one saved conversation",
    responses=CONVERSATION_ERROR_RESPONSES,
)
def read_conversation(
    conversation_id: int, user: CurrentUser, db: DbSession
) -> ConversationDetailResponse:
    return ConversationDetailResponse.model_validate(
        get_conversation(db, user, conversation_id)
    )


@router.delete(
    "/{conversation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete one saved conversation",
    responses=CONVERSATION_ERROR_RESPONSES,
)
def remove_conversation(conversation_id: int, user: CurrentUser, db: DbSession) -> None:
    delete_conversation(db, user, conversation_id)


@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete every saved conversation",
    responses=AUTH_REQUIRED_RESPONSES,
)
def remove_all_conversations(user: CurrentUser, db: DbSession) -> None:
    delete_all_conversations(db, user)
