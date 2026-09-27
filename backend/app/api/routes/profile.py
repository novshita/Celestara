"""The one saved birth profile per user."""

from __future__ import annotations

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.api.errors import AUTH_REQUIRED_RESPONSES, NOT_FOUND_RESPONSES
from app.api.schemas import BirthProfileResponse, SaveProfileRequest
from app.db.models import BirthProfile
from app.services.profile.service import get_profile, save_profile, to_birth_data

router = APIRouter(prefix="/profile", tags=["profile"])


def _to_response(profile: BirthProfile) -> BirthProfileResponse:
    return BirthProfileResponse(
        id=profile.id,
        birth=to_birth_data(profile),
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.get(
    "",
    response_model=BirthProfileResponse,
    summary="Get the saved birth profile",
    responses=NOT_FOUND_RESPONSES,
)
def read_profile(user: CurrentUser, db: DbSession) -> BirthProfileResponse:
    """404s if nothing has been saved yet - product spec §8 requires an
    unknown birth time to be a valid, explicit state, and the same principle
    applies to an unset profile: absence is reported, not defaulted."""
    return _to_response(get_profile(db, user))


@router.put(
    "",
    response_model=BirthProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Create or replace the saved birth profile",
    responses=AUTH_REQUIRED_RESPONSES,
)
def write_profile(
    request: SaveProfileRequest, user: CurrentUser, db: DbSession
) -> BirthProfileResponse:
    """A `PUT` because it always replaces the whole record: product spec §28
    allows exactly one profile per account, so there is no partial-update
    case and no id to address a second one with."""
    return _to_response(save_profile(db, user, request.birth))
