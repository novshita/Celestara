"""Vocabulary for the AI layer's request handling.

Plain enums, no behaviour: the API schema reports them and the services
decide them, so they live where neither depends on the other.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class Intent(str, Enum):
    """What a question is asking for - the minimum set from engineering
    spec §14, in the spec's own order."""

    BIRTH_CHART_EXPLANATION = "birth_chart_explanation"
    VEDIC_QUESTION = "vedic_question"
    WESTERN_QUESTION = "western_question"
    COMPARE_QUESTION = "compare_question"
    PLANET_EXPLORATION = "planet_exploration"
    TRANSIT_QUESTION = "transit_question"
    DASHA_QUESTION = "dasha_question"
    READING_REQUEST = "reading_request"
    GENERAL_EDUCATION = "general_education"
    HIGH_STAKES = "high_stakes"
    UNSUPPORTED = "unsupported"
    """Not about astrology at all (product spec §2: not a general-purpose
    chatbot)."""


class SafetyCategory(str, Enum):
    """Why a question counts as high-stakes (product spec §21)."""

    CRISIS = "crisis"
    """The person may be in danger. Handled before anything astrological."""

    MEDICAL = "medical"
    LEGAL = "legal"
    FINANCIAL = "financial"
    MAJOR_LIFE_DECISION = "major_life_decision"

    CERTAINTY_SEEKING = "certainty_seeking"
    """Asks astrology to say what *will* happen - spec §21's own example is
    "Will I definitely get this job?". Not a professional-advice domain, but
    the answer must still avoid certainty and reframe toward reflection."""


class ReadingTopic(str, Enum):
    """The life-area focus of a reading (product spec §13).

    CAREER, LOVE, RELATIONSHIPS and GROWTH can focus any reading, including
    the daily, weekly and monthly ones ("select a topic"). BIRTH_CHART is
    the one category that is not a focus: it reads the natal chart alone,
    with no transits, so it only exists as its own reading.
    """

    BIRTH_CHART = "birth_chart"
    CAREER = "career"
    LOVE = "love"
    RELATIONSHIPS = "relationships"
    GROWTH = "growth"


class ExplanationDepth(str, Enum):
    """How technical an explanation should be (product spec §24): beginner
    by default, with technical detail on request or by saved preference."""

    BEGINNER = "beginner"
    TECHNICAL = "technical"


@dataclass(frozen=True)
class FactGroup:
    """A set of calculated facts that grounded an answer, of one `kind`:
    `natal_chart`, `transits`, `period_changes`, `dasha`, or `unavailable`
    (what could not be calculated, stated so the gap is never filled in)."""

    kind: str
    facts: tuple[str, ...]


@dataclass(frozen=True)
class KnowledgeRef:
    """A curated knowledge entry that was retrieved for an answer."""

    id: str
    title: str
    category: str
    version: int


@dataclass(frozen=True)
class AnswerFactors:
    """What an answer was built from (product spec §23): the calculated
    facts, the curated knowledge, and how much user context was supplied.

    Maps to the four layers the spec asks to keep apart: `calculated` are the
    chart facts; `knowledge` is the traditional interpretation; the answer
    text itself is the AI's explanation; and `memory_used` and
    `history_turns` say how much was specific to this person.
    """

    calculated: tuple[FactGroup, ...] = ()
    knowledge: tuple[KnowledgeRef, ...] = ()
    memory_used: int = 0
    history_turns: int = 0

    @property
    def kinds(self) -> tuple[str, ...]:
        return tuple(group.kind for group in self.calculated)
