"""User-controlled memory (product spec §19).

Memory is what the user explicitly asked the guide to keep, and nothing
else: no function in this module is called from a conversation, so nothing a
user says can become a memory by itself. The user can list, add and delete
memories, and deleting an account deletes them with it.
"""

from __future__ import annotations

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db.models import Memory, User

#: Bounds what can be stored per user, and so how much a single prompt can be
#: asked to carry.
MAX_MEMORIES = 50

#: Most recent memories handed to the model per answer.
MEMORIES_PER_PROMPT = 20


class MemoryNotFoundError(ValueError):
    """No memory with this id, or it belongs to someone else - the two are
    indistinguishable on purpose, as for journal entries."""


class MemoryLimitError(ValueError):
    """The user already keeps `MAX_MEMORIES` memories."""


def list_memories(db: Session, user: User) -> list[Memory]:
    """Newest first."""
    return list(
        db.scalars(
            select(Memory).where(Memory.user_id == user.id).order_by(Memory.id.desc())
        )
    )


def add_memory(db: Session, user: User, kind: str, content: str) -> Memory:
    count = db.scalar(select(func.count()).select_from(Memory).where(Memory.user_id == user.id))
    if (count or 0) >= MAX_MEMORIES:
        raise MemoryLimitError(f"already keeping {MAX_MEMORIES} memories")

    memory = Memory(user_id=user.id, kind=kind, content=content)
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return memory


def delete_memory(db: Session, user: User, memory_id: int) -> None:
    memory = db.scalars(
        select(Memory).where(Memory.id == memory_id, Memory.user_id == user.id)
    ).first()
    if memory is None:
        raise MemoryNotFoundError(f"no memory {memory_id}")
    db.delete(memory)
    db.commit()


def delete_all_memories(db: Session, user: User) -> None:
    db.execute(delete(Memory).where(Memory.user_id == user.id))
    db.commit()


def memories_for_prompt(db: Session, user: User | None) -> list[Memory]:
    """What the guide is given as context for an answer. Nothing for an
    anonymous caller, who has none."""
    if user is None:
        return []
    return list_memories(db, user)[:MEMORIES_PER_PROMPT]
