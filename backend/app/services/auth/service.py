"""Registration, login and session management.

Sessions are opaque bearer tokens (`app.domain.auth.generate_session_token`),
stored hashed, with a fixed lifetime rather than a refresh scheme - the
simplest thing that satisfies engineering spec §33's "authentication ...
for saved data" without introducing JWTs or a token-refresh protocol before
there is a frontend to exercise one.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import AuthSession, User
from app.domain.auth import generate_session_token, hash_password, hash_token, verify_password

#: How long a session stays valid after login. Overridable for tests, which
#: is also why this is read at call time rather than import time.
_DEFAULT_SESSION_TTL_DAYS = 30


def _session_ttl_days() -> int:
    return int(os.getenv("SESSION_TTL_DAYS", str(_DEFAULT_SESSION_TTL_DAYS)))


def _now_utc_naive() -> datetime:
    """UTC "now" with `tzinfo` stripped.

    SQLite (the default `DATABASE_URL`) does not persist `tzinfo`: a value
    written as timezone-aware comes back naive, which makes a direct `<`
    comparison against a freshly-computed aware value raise `TypeError`.
    Treating every session timestamp as naive-but-always-UTC sidesteps that
    inconsistency entirely rather than depending on what a given backend
    round-trips.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


class EmailAlreadyRegisteredError(ValueError):
    """The email is already attached to an account.

    Deliberately vague in its user-facing message (see the route) about
    *why* registration failed would let an attacker enumerate which emails
    have accounts; the distinct exception type exists so the API layer can
    still choose the right status code.
    """


class InvalidCredentialsError(ValueError):
    """Email/password did not match. Never says which one was wrong."""


class InvalidSessionError(ValueError):
    """The bearer token is missing, unknown, or past its expiry."""


def register_user(db: Session, email: str, password: str) -> User:
    """Create an account. Raises `EmailAlreadyRegisteredError` on a clash."""
    existing = db.scalars(select(User).where(User.email == email)).first()
    if existing is not None:
        raise EmailAlreadyRegisteredError(f"{email} is already registered")

    user = User(email=email, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    """Verify credentials and return the matching user.

    Raises `InvalidCredentialsError` for both "no such email" and "wrong
    password" - collapsing the two prevents an attacker from using the
    login endpoint to discover which emails are registered.
    """
    user = db.scalars(select(User).where(User.email == email)).first()
    if user is None or not verify_password(password, user.password_hash):
        raise InvalidCredentialsError("email or password is incorrect")
    return user


def create_session(db: Session, user: User) -> str:
    """Start a session for `user`, returning the raw token.

    The raw token is returned exactly once and never persisted - only its
    hash is. Losing the database contents does not hand over live sessions.
    """
    token = generate_session_token()
    session = AuthSession(
        user_id=user.id,
        token_hash=hash_token(token),
        expires_at=_now_utc_naive() + timedelta(days=_session_ttl_days()),
    )
    db.add(session)
    db.commit()
    return token


def get_user_by_token(db: Session, token: str) -> User:
    """Resolve a bearer token to its owning user.

    Raises `InvalidSessionError` for an unknown or expired token so the API
    layer can return 401 without leaking which case it was.
    """
    session = db.scalars(
        select(AuthSession).where(AuthSession.token_hash == hash_token(token))
    ).first()

    if session is None or session.expires_at < _now_utc_naive():
        raise InvalidSessionError("session is invalid or has expired")

    return session.user


def revoke_session(db: Session, token: str) -> None:
    """Log out: delete the session row so the token can never be reused."""
    session = db.scalars(
        select(AuthSession).where(AuthSession.token_hash == hash_token(token))
    ).first()
    if session is not None:
        db.delete(session)
        db.commit()


def delete_account(db: Session, user: User) -> None:
    """Permanently remove a user and everything owned by them.

    Engineering spec §33 calls this a "secure deletion workflow": the ORM
    cascade on `User` (`app.db.models`) means this one `delete` also removes
    the birth profile, journal entries and every session - there is nothing
    left to clean up afterwards, and no code path can accidentally leave an
    orphaned row.
    """
    db.delete(user)
    db.commit()
