"""Saved preferences: explanation depth and calculation configuration."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.api.errors import AUTH_REQUIRED_RESPONSES
from app.api.schemas import PreferencesRequest, PreferencesResponse
from app.services.preferences.service import get_preferences, save_preferences

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.get(
    "",
    response_model=PreferencesResponse,
    summary="Get saved preferences",
    responses=AUTH_REQUIRED_RESPONSES,
)
def read_preferences(user: CurrentUser, db: DbSession) -> PreferencesResponse:
    """The defaults if nothing has been saved yet."""
    saved = get_preferences(db, user)
    return PreferencesResponse(
        explanation_depth=saved.explanation_depth,
        calculation_config=saved.calculation_config,
    )


@router.put(
    "",
    response_model=PreferencesResponse,
    summary="Replace saved preferences",
    responses=AUTH_REQUIRED_RESPONSES,
)
def replace_preferences(
    request: PreferencesRequest, user: CurrentUser, db: DbSession
) -> PreferencesResponse:
    """Applied by default to the AI Guide and readings when the request does
    not say otherwise. The chart endpoints take no account, so a client wanting
    its saved configuration there passes it in the request."""
    saved = save_preferences(
        db, user, request.explanation_depth, request.calculation_config
    )
    return PreferencesResponse(
        explanation_depth=saved.explanation_depth,
        calculation_config=saved.calculation_config,
    )
