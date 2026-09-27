"""Registration, login and logout."""

from __future__ import annotations

from fastapi import APIRouter, status

from app.api.deps import CurrentToken, DbSession
from app.api.errors import (
    AUTH_REQUIRED_RESPONSES,
    LOGIN_ERROR_RESPONSES,
    REGISTER_ERROR_RESPONSES,
)
from app.api.schemas import (
    AuthTokenResponse,
    LoginRequest,
    RegisterRequest,
    UserResponse,
)
from app.services.auth.service import (
    authenticate_user,
    create_session,
    register_user,
    revoke_session,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account",
    responses=REGISTER_ERROR_RESPONSES,
)
def register(request: RegisterRequest, db: DbSession) -> UserResponse:
    """Create an account. Does not log the user in - call `/auth/login` next.

    Kept as two steps rather than returning a token here too: it keeps this
    endpoint's only job "does this email exist now", which is what a
    duplicate-email 409 needs to be checking.
    """
    user = register_user(db, request.email, request.password)
    return UserResponse.model_validate(user)


@router.post(
    "/login",
    response_model=AuthTokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Exchange credentials for a session token",
    responses=LOGIN_ERROR_RESPONSES,
)
def login(request: LoginRequest, db: DbSession) -> AuthTokenResponse:
    """Return a bearer token. Send it back as `Authorization: Bearer <token>`
    on every authenticated request."""
    user = authenticate_user(db, request.email, request.password)
    token = create_session(db, user)
    return AuthTokenResponse(access_token=token)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke the current session",
    responses=AUTH_REQUIRED_RESPONSES,
)
def logout(token: CurrentToken, db: DbSession) -> None:
    """Delete the session so the token can never be used again.

    Not idempotent-safe in the usual REST sense on purpose: an already-
    invalid token still requires a valid `Authorization` header to reach
    this handler at all, so there is no unauthenticated variant to worry
    about accepting twice.
    """
    revoke_session(db, token)
