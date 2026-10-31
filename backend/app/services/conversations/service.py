"""Saved AI Guide conversations (product spec §19).

Only logged-in users have them; an anonymous visitor's questions are never
stored. A conversation holds the question and answer text the user sees, so
the user can read it back and delete it - one conversation or all of them -
and it goes with their account.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Conversation, ConversationMessage, User

#: How much of the opening question becomes the conversation's title.
TITLE_LENGTH = 60

#: Most recent messages (so 3 question-and-answer turns) given to the model
#: when a follow-up arrives, each cut to `HISTORY_MESSAGE_LENGTH` characters:
#: enough to follow what "and what about that?" refers to, bounded so a long
#: conversation cannot grow a prompt without limit.
HISTORY_MESSAGES = 6
HISTORY_MESSAGE_LENGTH = 800


class ConversationNotFoundError(ValueError):
    """No conversation with this id, or it belongs to someone else - the two
    are indistinguishable on purpose, as for journal entries."""


def _title(question: str) -> str:
    collapsed = " ".join(question.split())
    if len(collapsed) <= TITLE_LENGTH:
        return collapsed
    return collapsed[: TITLE_LENGTH - 1].rstrip() + "…"


def list_conversations(db: Session, user: User) -> list[Conversation]:
    """Most recently started first (by id, for the reason `list_entries`
    gives: timestamps can tie)."""
    return list(
        db.scalars(
            select(Conversation)
            .where(Conversation.user_id == user.id)
            .order_by(Conversation.id.desc())
        )
    )


def get_conversation(db: Session, user: User, conversation_id: int) -> Conversation:
    conversation = db.scalars(
        select(Conversation).where(
            Conversation.id == conversation_id, Conversation.user_id == user.id
        )
    ).first()
    if conversation is None:
        raise ConversationNotFoundError(f"no conversation {conversation_id}")
    return conversation


def start_conversation(db: Session, user: User, first_question: str) -> Conversation:
    conversation = Conversation(user_id=user.id, title=_title(first_question))
    db.add(conversation)
    db.flush()
    return conversation


def history_for_prompt(conversation: Conversation) -> list[tuple[str, str]]:
    """The last few messages, oldest first, as (role, text)."""
    recent = conversation.messages[-HISTORY_MESSAGES:]
    return [(m.role, m.content[:HISTORY_MESSAGE_LENGTH]) for m in recent]


def record_exchange(
    db: Session, conversation: Conversation, question: str, answer: str
) -> None:
    conversation.messages.append(ConversationMessage(role="user", content=question))
    conversation.messages.append(ConversationMessage(role="assistant", content=answer))
    db.commit()


def delete_conversation(db: Session, user: User, conversation_id: int) -> None:
    db.delete(get_conversation(db, user, conversation_id))
    db.commit()


def delete_all_conversations(db: Session, user: User) -> None:
    # Through the ORM, not a bulk DELETE, so each conversation's messages go
    # with it via the relationship's cascade.
    for conversation in list_conversations(db, user):
        db.delete(conversation)
    db.commit()
