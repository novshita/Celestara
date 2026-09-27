"""Journal CRUD."""

from __future__ import annotations

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.api.errors import AUTH_REQUIRED_RESPONSES, NOT_FOUND_RESPONSES
from app.api.schemas import (
    JournalEntryListResponse,
    JournalEntryRequest,
    JournalEntryResponse,
)
from app.services.journal.service import (
    create_entry,
    delete_entry,
    get_entry,
    list_entries,
    update_entry,
)

router = APIRouter(prefix="/journal", tags=["journal"])


@router.get(
    "",
    response_model=JournalEntryListResponse,
    summary="List journal entries",
    responses=AUTH_REQUIRED_RESPONSES,
)
def read_entries(user: CurrentUser, db: DbSession) -> JournalEntryListResponse:
    """Newest first - the reflective use case (product spec §16) is almost
    always "what did I write recently", not a full chronological archive."""
    entries = list_entries(db, user)
    return JournalEntryListResponse(
        entries=tuple(JournalEntryResponse.model_validate(e) for e in entries)
    )


@router.post(
    "",
    response_model=JournalEntryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a journal entry",
    responses=AUTH_REQUIRED_RESPONSES,
)
def create(
    request: JournalEntryRequest, user: CurrentUser, db: DbSession
) -> JournalEntryResponse:
    entry = create_entry(db, user, request.title, request.body)
    return JournalEntryResponse.model_validate(entry)


@router.get(
    "/{entry_id}",
    response_model=JournalEntryResponse,
    summary="Get a journal entry",
    responses=NOT_FOUND_RESPONSES,
)
def read_entry(
    entry_id: int, user: CurrentUser, db: DbSession
) -> JournalEntryResponse:
    return JournalEntryResponse.model_validate(get_entry(db, user, entry_id))


@router.put(
    "/{entry_id}",
    response_model=JournalEntryResponse,
    summary="Replace a journal entry's title and body",
    responses=NOT_FOUND_RESPONSES,
)
def update(
    entry_id: int,
    request: JournalEntryRequest,
    user: CurrentUser,
    db: DbSession,
) -> JournalEntryResponse:
    entry = update_entry(db, user, entry_id, request.title, request.body)
    return JournalEntryResponse.model_validate(entry)


@router.delete(
    "/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a journal entry",
    responses=NOT_FOUND_RESPONSES,
)
def delete(entry_id: int, user: CurrentUser, db: DbSession) -> None:
    delete_entry(db, user, entry_id)
