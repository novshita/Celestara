"""SQLAlchemy ORM models.

These are the persisted counterparts of a subset of engineering spec §19's
conceptual data model: `User`, `Profile` (as `BirthProfile`), `JournalEntry`,
an `AuthSession` table backing the auth layer, and for the AI layer
`UserPreferences`, `Conversation`/`ConversationMessage`, `Memory` and
`AiAuditRecord`. There is no table for the knowledge base: it is versioned
files in the repository (`app/services/knowledge/corpus`), not rows, so every
change to it is a reviewed diff. Generated readings are not stored either.

Kept separate from the Pydantic domain models in `app/domain/`: those
describe calculation inputs/outputs and are frozen value objects, while these
describe mutable, persisted rows. Conflating the two would mean either the
calculation layer depends on SQLAlchemy, or the ORM models grow calculation
fields neither needs.
"""

from __future__ import annotations

import datetime as dt

from sqlalchemy import DateTime, ForeignKey, Integer, Text, UniqueConstraint, func
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
    preferences: Mapped[UserPreferences | None] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    conversations: Mapped[list[Conversation]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    memories: Mapped[list[Memory]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    ai_audit_records: Mapped[list[AiAuditRecord]] = relationship(
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


class UserPreferences(Base):
    """Settings a user keeps across visits (product spec §24, §29)."""

    __tablename__ = "user_preferences"
    __table_args__ = (UniqueConstraint("user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    explanation_depth: Mapped[str] = mapped_column(default="beginner")
    """`beginner` or `technical`, stored as text so a new level is a
    domain-layer change only (the same reason as `time_confidence`)."""

    calculation_config: Mapped[str | None] = mapped_column(Text, default=None)
    """A `CalculationConfig` as JSON, validated on the way in. None means
    the application default."""

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="preferences")


class Conversation(Base):
    """A saved AI Guide conversation. Only logged-in users get these;
    anonymous visitors stay stateless (product spec §19)."""

    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    title: Mapped[str]
    """The opening question, shortened - what the user would recognise it by."""

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship(back_populates="conversations")
    messages: Mapped[list[ConversationMessage]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ConversationMessage.id",
    )


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id"), index=True
    )

    role: Mapped[str]
    """`user` or `assistant`."""
    content: Mapped[str] = mapped_column(Text)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class Memory(Base):
    """Something the user chose to have the guide remember (product spec
    §19). Only ever created by an explicit request from the user: nothing in
    a conversation becomes memory on its own."""

    __tablename__ = "memories"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    kind: Mapped[str]
    """`preference` or `note`."""
    content: Mapped[str] = mapped_column(Text)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User] = relationship(back_populates="memories")


class AiAuditRecord(Base):
    """How one AI answer was produced (engineering spec §22).

    Deliberately holds no personal content: not the question, not the
    answer, not a single chart value. It records which *kinds* of fact
    grounded the answer (`natal_chart`, `transits`...), which curated
    knowledge entries were retrieved, how many memories and prior turns were
    supplied, the intent, model, safety flags and timing - enough to explain
    and debug an answer without becoming a second copy of what the user said
    (spec §20, §32). `user_id` is null for an anonymous request; a logged-in
    user's records go with their account.
    """

    __tablename__ = "ai_audit_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), index=True, default=None
    )

    request_id: Mapped[str]
    endpoint: Mapped[str]
    """`chat` or the reading's period."""
    intent: Mapped[str | None] = mapped_column(default=None)
    system: Mapped[str | None] = mapped_column(default=None)
    model: Mapped[str | None] = mapped_column(default=None)
    """None when the answer was fixed text that never reached the model."""
    depth: Mapped[str]

    factor_kinds: Mapped[str] = mapped_column(default="")
    """Comma-separated kinds of calculated fact used."""
    knowledge_ids: Mapped[str] = mapped_column(default="")
    """Comma-separated ids of retrieved knowledge entries."""
    safety_flags: Mapped[str] = mapped_column(default="")
    memory_count: Mapped[int] = mapped_column(Integer, default=0)
    history_turns: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped[User | None] = relationship(back_populates="ai_audit_records")
