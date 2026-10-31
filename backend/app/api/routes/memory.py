"""User-controlled memory: list, add, delete one, delete all."""

from __future__ import annotations

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.api.errors import AUTH_REQUIRED_RESPONSES, MEMORY_ERROR_RESPONSES
from app.api.schemas import MemoryListResponse, MemoryRequest, MemoryResponse
from app.services.memory.service import (
    add_memory,
    delete_all_memories,
    delete_memory,
    list_memories,
)

router = APIRouter(prefix="/memory", tags=["memory"])


@router.get(
    "",
    response_model=MemoryListResponse,
    summary="List what the guide has been asked to remember",
    responses=AUTH_REQUIRED_RESPONSES,
)
def read_memories(user: CurrentUser, db: DbSession) -> MemoryListResponse:
    return MemoryListResponse(
        memories=tuple(MemoryResponse.model_validate(m) for m in list_memories(db, user))
    )


@router.post(
    "",
    response_model=MemoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ask the guide to remember something",
    responses=MEMORY_ERROR_RESPONSES,
)
def create_memory(
    request: MemoryRequest, user: CurrentUser, db: DbSession
) -> MemoryResponse:
    """Memory is persistent but user-controlled (product spec §19): it is
    created here, on request, and nowhere else. It is given to the guide as
    background about the person, never as instructions."""
    return MemoryResponse.model_validate(
        add_memory(db, user, request.kind, request.content)
    )


@router.delete(
    "/{memory_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Forget one memory",
    responses=MEMORY_ERROR_RESPONSES,
)
def remove_memory(memory_id: int, user: CurrentUser, db: DbSession) -> None:
    delete_memory(db, user, memory_id)


@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Forget everything",
    responses=AUTH_REQUIRED_RESPONSES,
)
def remove_all_memories(user: CurrentUser, db: DbSession) -> None:
    delete_all_memories(db, user)
