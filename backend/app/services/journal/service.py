"""Journal CRUD.

Product spec §16: reflective, not predictive - this module only stores and
retrieves entries; nothing here reads or writes chart data.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import JournalEntry, User


class JournalEntryNotFoundError(ValueError):
    """No entry with this id, or it belongs to a different user.

    The two cases are deliberately indistinguishable to the caller: telling
    an authenticated user "that id belongs to someone else" instead of "that
    id does not exist" would confirm the id is in use, which is exactly the
    cross-user information leak engineering spec §33 rules out.
    """


def list_entries(db: Session, user: User) -> list[JournalEntry]:
    """Newest first, ordered by `id` rather than `created_at`.

    Two entries created within the same second get the same
    `CURRENT_TIMESTAMP` value on SQLite, at which point sorting by
    `created_at` alone leaves their relative order unspecified. `id` is
    assigned in insertion order and never repeats, so it is both correct
    today and immune to whatever timestamp resolution the production
    database (Postgres, spec engineering §4) turns out to have.
    """
    return list(
        db.scalars(
            select(JournalEntry)
            .where(JournalEntry.user_id == user.id)
            .order_by(JournalEntry.id.desc())
        )
    )


def _owned_entry(db: Session, user: User, entry_id: int) -> JournalEntry:
    entry = db.scalars(
        select(JournalEntry).where(
            JournalEntry.id == entry_id, JournalEntry.user_id == user.id
        )
    ).first()
    if entry is None:
        raise JournalEntryNotFoundError(f"no journal entry {entry_id}")
    return entry


def get_entry(db: Session, user: User, entry_id: int) -> JournalEntry:
    return _owned_entry(db, user, entry_id)


def create_entry(db: Session, user: User, title: str, body: str) -> JournalEntry:
    entry = JournalEntry(user_id=user.id, title=title, body=body)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def update_entry(
    db: Session, user: User, entry_id: int, title: str, body: str
) -> JournalEntry:
    entry = _owned_entry(db, user, entry_id)
    entry.title = title
    entry.body = body
    db.commit()
    db.refresh(entry)
    return entry


def delete_entry(db: Session, user: User, entry_id: int) -> None:
    entry = _owned_entry(db, user, entry_id)
    db.delete(entry)
    db.commit()
