"""Shared FastAPI dependencies: the database session and the current user.

`get_current_user` is the one place `Authorization: Bearer <token>` is read
and turned into a `User`; every route that needs auth depends on this rather
than parsing the header itself, so there is exactly one code path to audit
for engineering spec §33's "authentication ... for saved data".
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.session import get_db
from app.services.auth.service import InvalidSessionError, get_user_by_token

#: `auto_error=False` so a missing header raises our own `InvalidSessionError`
#: (and thus our own `ErrorResponse` shape) instead of FastAPI's default
#: 403/"Not authenticated", keeping every failure mode of this dependency
#: consistent for the client.
bearer_scheme = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def get_bearer_token(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
) -> str:
    """The raw token, before it is resolved to a user.

    Exposed separately from `get_current_user` because logout needs the
    token itself (to find and delete the session row), not the user it
    currently resolves to.
    """
    if credentials is None:
        raise InvalidSessionError("no bearer token was supplied")
    return credentials.credentials


def get_current_user(
    db: DbSession, token: Annotated[str, Depends(get_bearer_token)]
) -> User:
    return get_user_by_token(db, token)


CurrentToken = Annotated[str, Depends(get_bearer_token)]
CurrentUser = Annotated[User, Depends(get_current_user)]
