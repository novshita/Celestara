"""Recurring themes in a user's own questions (product spec §20).

The spec's four conditions, and where each is met:

- *Avoid overwhelming users.* At most one theme is ever reported, only once a
  topic has come up `MIN_QUESTIONS` times within `WINDOW_DAYS`.
- *Avoid claiming psychological certainty.* The note states a count, nothing
  more, and says outright that it describes the questions and not the person.
- *Be transparent that it is based on conversation/context.* The note names
  its source - the user's saved Guide questions.
- *Be user-controllable.* A preference turns it off per user, and a feature
  flag turns it off for the deployment.

It is computed on demand from the user's own saved questions, never stored,
never sent to the model and never shown to anyone else, so deleting the
conversations or the account removes everything it was based on. This is the
basic form; "advanced AI pattern detection" is a deferred feature (§31).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.flags import Flag, is_enabled
from app.core.timeutil import as_utc
from app.db.models import Conversation, ConversationMessage, User
from app.domain.ai import ReadingTopic
from app.services.preferences.service import get_preferences

#: How far back a question still counts.
WINDOW_DAYS = 30

#: How many questions on one topic make a theme. Two is coincidence.
MIN_QUESTIONS = 3

#: Newest questions considered; bounds the work for a very active user.
MAX_QUESTIONS = 200


def _rx(pattern: str) -> re.Pattern[str]:
    return re.compile(pattern, re.IGNORECASE)


#: Plain vocabulary per life area, matching the topics the readings use.
#: Deliberately modest: a question that matches nothing simply isn't counted.
_TOPICS: tuple[tuple[ReadingTopic, str, re.Pattern[str]], ...] = (
    (
        ReadingTopic.CAREER,
        "Career",
        _rx(
            r"\b(?:career|job|jobs|promotion|profession\w*|business|boss|office"
            r"|employ\w*|interview|workplace|my\s+work)\b"
        ),
    ),
    (
        ReadingTopic.LOVE,
        "Love",
        _rx(r"\b(?:love|romanc\w*|romantic|dating|crush|soulmate|boyfriend|girlfriend)\b"),
    ),
    (
        ReadingTopic.RELATIONSHIPS,
        "Relationships",
        _rx(
            r"\b(?:relationships?|marriage|married|spouse|partner\w*|family"
            r"|friends?|friendship|parents?|mother|father)\b"
        ),
    ),
    (
        ReadingTopic.GROWTH,
        "Personal growth",
        _rx(
            r"\b(?:growth|purpose|confiden\w*|self[- ]?improvement"
            r"|personal\s+development|mindset|spiritual\w*|habits?)\b"
        ),
    ),
)


@dataclass(frozen=True)
class Pattern:
    topic: ReadingTopic
    count: int
    window_days: int
    note: str


@dataclass(frozen=True)
class PatternReport:
    enabled: bool
    """False when the feature is off for the deployment or for this user -
    the client then shows nothing, rather than an empty "no themes" state."""
    patterns: tuple[Pattern, ...]


def _note(label: str, count: int) -> str:
    return (
        f"{label} has come up in {count} of your saved questions in the last "
        f"{WINDOW_DAYS} days. This only counts the topics in what you asked "
        "the AI Guide, so it may simply reflect what you've been curious "
        "about - it isn't a conclusion about you."
    )


def find_patterns(questions: list[str]) -> list[Pattern]:
    """The theme (if any) in these questions: the most frequent topic that
    reaches `MIN_QUESTIONS`, the earlier-listed one winning a tie."""
    best: tuple[ReadingTopic, str, int] | None = None
    for topic, label, pattern in _TOPICS:
        count = sum(1 for question in questions if pattern.search(question))
        if count >= MIN_QUESTIONS and (best is None or count > best[2]):
            best = (topic, label, count)
    if best is None:
        return []
    topic, label, count = best
    return [Pattern(topic, count, WINDOW_DAYS, _note(label, count))]


def detect_patterns(
    db: Session, user: User, now: datetime | None = None
) -> PatternReport:
    if not is_enabled(Flag.PATTERN_DETECTION):
        return PatternReport(enabled=False, patterns=())
    if not get_preferences(db, user).pattern_detection:
        return PatternReport(enabled=False, patterns=())

    cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=WINDOW_DAYS)
    rows = db.execute(
        select(ConversationMessage.content, ConversationMessage.created_at)
        .join(Conversation, Conversation.id == ConversationMessage.conversation_id)
        .where(Conversation.user_id == user.id, ConversationMessage.role == "user")
        .order_by(ConversationMessage.id.desc())
        .limit(MAX_QUESTIONS)
    ).all()
    recent = [content for content, created in rows if as_utc(created) >= cutoff]
    return PatternReport(enabled=True, patterns=tuple(find_patterns(recent)))
