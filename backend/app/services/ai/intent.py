"""Intent classification (engineering spec §14).

Deterministic keyword rules, which §14 allows ("deterministic rules, an LLM
classifier, or a hybrid approach depending on performance and reliability
testing"). Rules are free, instant, reproducible, and testable; an LLM
classifier would add a paid call before every answer and a second place for
things to go wrong. If these rules prove too blunt in use, the hybrid the
spec describes is the next step.

Only two outcomes change what the system does today: HIGH_STAKES (safety
context and a notice) and UNSUPPORTED (declined without a model call). The
rest are reported in the response and recorded for what comes next - the
audit trail (§22) needs the intent, and so will pulling transit or dasha
facts into a chat answer - but classifying a question does not yet change
which facts it is grounded in.
"""

from __future__ import annotations

import re

from app.domain.ai import Intent
from app.services.ai.safety import SafetyAssessment, assess_question


def _rx(pattern: str) -> re.Pattern[str]:
    return re.compile(pattern, re.IGNORECASE)


_FIRST_PERSON = _rx(r"\b(?:i|me|my|mine|myself|i'm|i've|i'll)\b")

#: Vocabulary that means a question is about astrology. Broad on purpose:
#: an ordinary astrology question must never be called off-topic.
_ASTROLOGY_TERMS = _rx(
    r"\b(?:astrolog\w*|horoscop\w*|jyotish|vedic|western|chart|kundli|zodiac"
    r"|signs?|rashi|lagna|ascendant|rising|sun|moon|mars|mercury|jupiter"
    r"|venus|saturn|rahu|ketu|graha\w*|planet\w*|houses?|bhava|nakshatra"
    r"|dasha|transit\w*|gochar|aspects?|conjunction|retrograde|natal"
    r"|tropical|sidereal|ayanamsa|pada|trine|square|opposition|sextile"
    r"|birth|reading)\b"
)

#: Clear signs of an unrelated request. Deliberately narrow: wrongly
#: refusing a real astrology question is a worse failure than letting the
#: model decline an off-topic one itself, as its prompt already tells it to.
_OFF_TOPIC_CUES = _rx(
    r"\b(?:write|generate|debug|fix|refactor)\s+(?:me\s+)?(?:a\s+|an\s+|some\s+"
    r"|this\s+|my\s+)?(?:\w+\s+)?(?:code|script|function|program|sql|query"
    r"|essay|poem|story|email|letter|resume|cv|cover\s+letter)\b"
    r"|\b(?:recipe|weather|translate|homework|capital\s+of|who\s+won"
    r"|solve\s+(?:this|the)|movie\s+recommend\w*)\b"
    r"|\bwhat\s+is\s+\d+\s*[+\-*/x]\s*\d+"
)

_EDUCATION_OPENER = _rx(
    r"^\s*(?:what\s+(?:is|are|does)|what's|how\s+(?:does|do|is)|explain|define"
    r"|why\s+(?:is|are|do|does))\b"
)

#: Checked ahead of general education: "what's the difference between Vedic
#: and Western?" is a concept question, but it is Compare mode's whole
#: subject, so it should read as one.
_COMPARE = _rx(
    r"\b(?:compar\w*|versus|vs\.?|both\s+systems|differences?\s+between"
    r"|vedic\s+(?:and|or)\s+western|western\s+(?:and|or)\s+vedic)\b"
)

#: First match wins, so order is precedence: the more specific the subject,
#: the earlier it sits.
_RULES: tuple[tuple[Intent, re.Pattern[str]], ...] = (
    (
        Intent.DASHA_QUESTION,
        _rx(r"\b(?:dasha|mahadasha|antardasha|vimshottari|planetary\s+period)\b"),
    ),
    (
        Intent.TRANSIT_QUESTION,
        _rx(
            r"\b(?:transit\w*|gochar|retrograde|sade\s*sati|right\s+now"
            r"|current(?:ly)?\s+(?:sky|planets?|position\w*))\b"
        ),
    ),
    (
        Intent.READING_REQUEST,
        _rx(
            r"\b(?:reading|horoscope|(?:this|next)\s+(?:week|month|year)"
            r"|today|tomorrow|tonight)\b"
        ),
    ),
    (
        Intent.WESTERN_QUESTION,
        _rx(
            r"\b(?:western|tropical|sun\s+sign|trine|square|opposition|sextile"
            r"|conjunction|aspects?|placidus|midheaven)\b"
        ),
    ),
    (
        Intent.VEDIC_QUESTION,
        _rx(
            r"\b(?:vedic|jyotish|rashi|nakshatra|lagna|bhava|sidereal|kundli"
            r"|lahiri|ayanamsa)\b"
        ),
    ),
    (
        Intent.PLANET_EXPLORATION,
        _rx(
            r"\b(?:sun|moon|mars|mercury|jupiter|venus|saturn|rahu|ketu|graha"
            r"|planet)\b"
        ),
    ),
    (
        Intent.BIRTH_CHART_EXPLANATION,
        _rx(r"\b(?:chart|ascendant|rising|natal|birth)\b"),
    ),
)

#: When no rule matches, the chart system the caller asked about decides.
_BY_SYSTEM = {
    "vedic": Intent.VEDIC_QUESTION,
    "western": Intent.WESTERN_QUESTION,
    "compare": Intent.COMPARE_QUESTION,
}


def classify_intent(
    question: str, system: str, assessment: SafetyAssessment | None = None
) -> Intent:
    """What `question` is asking for.

    Safety comes first and outranks everything: a high-stakes question is
    HIGH_STAKES whatever else it also is. After that, off-topic requests,
    then compare, then general education (a concept question with no "my"
    in it), then the subject rules above in order.
    """
    assessment = assessment or assess_question(question)
    if assessment.high_stakes:
        return Intent.HIGH_STAKES

    if _OFF_TOPIC_CUES.search(question) and not _ASTROLOGY_TERMS.search(question):
        return Intent.UNSUPPORTED

    if _COMPARE.search(question):
        return Intent.COMPARE_QUESTION

    if _EDUCATION_OPENER.search(question) and not _FIRST_PERSON.search(question):
        return Intent.GENERAL_EDUCATION

    for intent, pattern in _RULES:
        if pattern.search(question):
            return intent

    return _BY_SYSTEM.get(system, Intent.BIRTH_CHART_EXPLANATION)
