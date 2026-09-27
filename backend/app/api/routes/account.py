"""Account deletion.

Its own route module rather than a method on `auth.py`: engineering spec
§20's "one-click delete my data" (product spec §29) is a distinct, higher-
stakes operation from anything else auth does, and keeping it separate means
it can get its own scrutiny in review rather than blending into login/logout.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.api.errors import AUTH_REQUIRED_RESPONSES
from app.services.auth.service import delete_account

router = APIRouter(prefix="/account", tags=["account"])


@router.delete(
    "/data",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Permanently delete the account and all associated data",
    responses=AUTH_REQUIRED_RESPONSES,
)
def delete_my_data(user: CurrentUser, db: DbSession) -> None:
    """Deletes the user, birth profile, journal entries and all sessions.

    Irreversible and immediate - product spec §29 asks for a "one-click"
    flow, not a soft-delete or a grace period. There is deliberately no
    confirmation step here: that belongs in the client, which can prompt
    before ever sending this request.
    """
    delete_account(db, user)
