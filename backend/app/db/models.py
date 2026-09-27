"""SQLAlchemy ORM models.

These are the persisted counterparts of a subset of engineering spec §19's
conceptual data model: `User`, `Profile` (as `BirthProfile`), `JournalEntry`,
plus an `AuthSession` table backing the auth layer. `Conversation`,
`Memory`, `Reading` and the knowledge-base entities are deliberately not
here yet - they belong to the AI layer, which has not been built, and
modelling them now would mean guessing at a shape driven by decisions
(provider, RAG chunking) that have not been made.

Kept separate from the Pydantic domain models in `app/domain/`: those
describe calculation inputs/outputs and are frozen value objects, while these
describe mutable, persisted rows. Conflating the two would mean either the
calculation layer depends on SQLAlchemy, or the ORM models grow calculation
fields neither needs.
"""

from __future__ import annotations

import datetime as dt

from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    password_hash: Mapped[str]

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # `uselist=False` makes this a one-to-one, matching product spec §28:
    # "There is one personal profile in V1." `delete-orphan` and
    # `passive_deletes=False` (the default) mean deleting a `User` in the ORM
    # cascades to its profile, journal entries and sessions - the "secure
    # deletion" account-closure flow deletes exactly one object.
    birth_profile: Mapped[BirthProfile | None] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    journal_entries: Mapped[list[JournalEntry]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    sessions: Mapped[list[AuthSession]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class BirthProfile(Base):
    """The one saved birth record a user's charts are calculated from.

    Mirrors `app.domain.birth_data.BirthData` field-for-field so converting
    between the two is a straight attribute copy, not a translation.
    """

    __tablename__ = "birth_profiles"
    __table_args__ = (UniqueConstraint("user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    birth_date: Mapped[dt.date]
    birth_time: Mapped[dt.time | None] = mapped_column(default=None)
    time_confidence: Mapped[str]
    """`BirthTimeConfidence` value, stored as text rather than a DB enum so
    adding a new confidence level is a domain-layer change only."""

    latitude: Mapped[float]
    longitude: Mapped[float]
    timezone_name: Mapped[str | None] = mapped_column(default=None)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="birth_profile")


class JournalEntry(Base):
    """A reflective entry, per product spec §16: reflective, not predictive."""

    __tablename__ = "journal_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    title: Mapped[str]
    body: Mapped[str] = mapped_column(Text)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="journal_entries")


class AuthSession(Base):
    """A logged-in session, identified by an opaque bearer token.

    Only the token's hash is stored (engineering spec §33: secrets are
    never held in a form a database leak could replay directly), the same
    principle as a password hash. Revocable by deleting the row, which is
    what logout and account deletion both do.
    """

    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    token_hash: Mapped[str] = mapped_column(unique=True, index=True)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="sessions")
