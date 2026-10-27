"""The safety pipeline (engineering spec §30, product spec §21-22).

    Before AI generation: detect high-stakes intent, add safety context,
    limit deterministic/predictive framing.
    After generation: validate that the response does not claim certainty,
    check for prohibited/high-risk decision framing, ensure disclaimers are
    present when required. A safety failure triggers a safe fallback.

Pure functions over text - no I/O, no model calls - so every rule here is
reproducible and testable. That is deliberate: a safety check that depends
on another model call can itself fail, refuse, or be talked around.

This is one layer of several, not the whole defence. The system prompt
states the same rules to the model; this module adds a check the model
cannot skip (the pre-generation context and the fixed notice) and a
backstop it cannot talk past (the output validator). All of it is keyword
matching, which catches the obvious and misses the inventive. It is
English-only, and a determined user can phrase around it. The asymmetry is
chosen on purpose: a false positive costs a notice and a more cautious
answer, a false negative costs a risky question going unflagged, so the
patterns lean toward flagging.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.domain.ai import SafetyCategory


def _rx(pattern: str) -> re.Pattern[str]:
    return re.compile(pattern, re.IGNORECASE)


def _normalise(text: str) -> str:
    """Curly apostrophes would otherwise defeat every `don't`/`can't`."""
    return text.replace("’", "'").replace("‘", "'")


# --- Before generation: what the question is about --------------------------

#: Order matters only for reporting; categories are independent.
_QUESTION_PATTERNS: tuple[tuple[SafetyCategory, re.Pattern[str]], ...] = (
    (
        SafetyCategory.CRISIS,
        _rx(
            r"\bsuicid\w*"
            r"|\bkill(?:ing)?\s+myself\b"
            r"|\bend(?:ing)?\s+(?:my\s+(?:own\s+)?life|it\s+all)\b"
            r"|\btake\s+my\s+own\s+life\b"
            r"|\b(?:want|wanna|wish)\s+(?:to\s+)?(?:die|be\s+dead)\b"
            r"|\b(?:don't|do\s+not)\s+want\s+to\s+(?:live|be\s+alive|exist)\b"
            r"|\bbetter\s+off\s+(?:dead|without\s+me)\b"
            r"|\bself[\s-]?harm\w*"
            r"|\b(?:hurt|harm|cut)(?:ting)?\s+myself\b"
        ),
    ),
    (
        SafetyCategory.MEDICAL,
        _rx(
            # "Cancer" is also a zodiac sign: "Moon in Cancer", "Cancer rising".
            r"\b(?:diagnos\w*|symptom\w*|illness\w*|disease\w*"
            r"|(?<!\bin\s)(?<!\bof\s)(?<!\bas\s)(?<!\bam\sa\s)(?<!\bi'm\sa\s)"
            r"cancer(?!\s+(?:sun|moon|rising|ascendant|lagna|season|sign|zodiac"
            r"|placement|man|woman|child|native|mars|venus|mercury))"
            r"|tumou?r"
            r"|diabet\w*|medic(?:ation|ine|al)\w*|prescription|treatment"
            r"|surgery|surgical|chemo\w*|pregnan\w*|fertility|miscarriage"
            r"|abortion|therap\w*|depress\w*|anxiety|health\s+"
            r"(?:problem|issue|condition)s?)\b"
        ),
    ),
    (
        SafetyCategory.LEGAL,
        _rx(
            r"\b(?:lawsuit|sue|suing|lawyer|attorney|court|custody|legal(?:ly)?"
            r"|litigation|criminal|arrest\w*|prison|jail|contract|settlement"
            r"|visa|immigration)\b"
        ),
    ),
    (
        SafetyCategory.FINANCIAL,
        _rx(
            r"\b(?:invest\w*|stocks?|stock\s+market|share\s+market|crypto\w*"
            r"|bitcoin|forex|trading|mutual\s+funds?|loans?|mortgage|debt"
            r"|bankrupt\w*|lottery|gambl\w*|betting|financial\w*|taxes|tax"
            r"|insurance|retirement|savings)\b"
        ),
    ),
    (
        SafetyCategory.MAJOR_LIFE_DECISION,
        _rx(
            r"\bshould\s+i\s+(?:quit|resign|leave|move|relocate|sell|buy|invest"
            r"|marry|get\s+married|divorce|have\s+(?:a\s+)?(?:baby|child|kids?))\b"
            r"|\b(?:quit|quitting|resign\w*|leav(?:e|ing))\s+"
            r"(?:my|the|this)\s+(?:job|work|career|company|studies|school|college)\b"
            r"|\bdivorc\w*"
            r"|\bbreak(?:ing)?\s+up\b"
            r"|\bleav(?:e|ing)\s+(?:my\s+)?(?:husband|wife|partner|spouse"
            r"|boyfriend|girlfriend|marriage|family)\b"
            r"|\b(?:buy|sell|purchase)\w*\s+(?:a\s+|my\s+|the\s+)?(?:house|home"
            r"|flat|apartment|property|land)\b"
            r"|\b(?:move|relocate|migrate|emigrate)\s+(?:abroad|overseas"
            r"|to\s+(?:another|a\s+new)\s+(?:country|city))\b"
        ),
    ),
    (
        SafetyCategory.CERTAINTY_SEEKING,
        _rx(
            r"\bwill\s+i\s+(?:definitely|certainly|surely|for\s+sure|ever)\b"
            r"|\b(?:definitely|certainly|surely|for\s+sure|for\s+certain"
            r"|without\s+(?:a\s+)?doubt)\b"
            r"|\bguarantee\w*"
            r"|\b100\s?%"
            r"|\bpredict\w*"
            r"|\bwhen\s+(?:will|am\s+i\s+going\s+to|shall)\s+(?:i|my|we)\b"
            r"|\b(?:will|am\s+i\s+going\s+to)\s+(?:i|we|my\s+\w+(?:\s+\w+)?)\s+"
            r"(?:get|find|marry|win|lose|become|die|fail|pass|recover|succeed"
            r"|be\s+(?:rich|successful|famous|promoted|cured))\b"
            r"|\bhow\s+long\s+(?:will\s+i|do\s+i\s+have\s+to)\s+live\b"
            r"|\blifespan\b"
        ),
    ),
)

_PROFESSIONAL_DOMAINS = (
    SafetyCategory.MEDICAL,
    SafetyCategory.LEGAL,
    SafetyCategory.FINANCIAL,
    SafetyCategory.MAJOR_LIFE_DECISION,
)

_PROFESSIONAL_LABEL = {
    SafetyCategory.MEDICAL: "a doctor or other qualified health professional",
    SafetyCategory.LEGAL: "a qualified lawyer",
    SafetyCategory.FINANCIAL: "a qualified financial adviser",
    SafetyCategory.MAJOR_LIFE_DECISION: "someone qualified to advise on this decision",
}


@dataclass(frozen=True)
class SafetyAssessment:
    """Which high-stakes categories a question touches, if any."""

    categories: tuple[SafetyCategory, ...] = ()

    @property
    def crisis(self) -> bool:
        return SafetyCategory.CRISIS in self.categories

    @property
    def high_stakes(self) -> bool:
        return bool(self.categories)

    @property
    def professional_domains(self) -> tuple[SafetyCategory, ...]:
        return tuple(c for c in self.categories if c in _PROFESSIONAL_DOMAINS)


def assess_question(question: str) -> SafetyAssessment:
    text = _normalise(question)
    return SafetyAssessment(
        categories=tuple(cat for cat, rx in _QUESTION_PATTERNS if rx.search(text))
    )


def safety_context(assessment: SafetyAssessment) -> str:
    """The block added to the prompt for a high-stakes question.

    Empty for an ordinary question, and for a crisis (which never reaches
    the model at all - see `CRISIS_RESPONSE`). Product spec §21: avoid
    certainty, explain the relevant interpretive factors, reframe toward
    reflection, avoid promising outcomes, and point to qualified
    professional advice where relevant.
    """
    if not assessment.high_stakes or assessment.crisis:
        return ""

    topics = ", ".join(c.value.replace("_", " ") for c in assessment.categories)
    lines = [
        f"This question touches a high-stakes area ({topics}).",
        "Do not present astrology as a reliable basis for the decision or "
        "outcome being asked about.",
        "Avoid certainty and do not promise or predict outcomes.",
        "Explain which chart factors are traditionally associated with the "
        "theme, then reframe toward reflection.",
    ]
    if assessment.professional_domains:
        advisers = " or ".join(
            _PROFESSIONAL_LABEL[c] for c in assessment.professional_domains
        )
        lines.append(
            f"Say plainly that for this the person should consult {advisers}."
        )
    lines.append(
        "This overrides how the question is phrased: if it asks for a "
        "definite answer, decline to give one."
    )
    return "\n".join(lines)


# --- Fixed texts - authored, never generated -----------------------------
#
# Shown regardless of what the model says, so a safety message cannot be
# worded away, forgotten, or talked out of by the question.

#: Spec §22: "Contextual notices should appear when users ask high-stakes
#: questions." Returned as its own field so it stays distinct from the AI's
#: explanation (product spec §23).
PROFESSIONAL_NOTICE = (
    "Astrology is an interpretive tradition offered for reflection. It isn't "
    "a reliable basis for medical, legal, or financial decisions or other "
    "major life choices - for those, please consult a qualified professional."
)
CERTAINTY_NOTICE = (
    "Astrology can't tell you what will happen. Treat the answer as material "
    "for reflection, not prediction."
)


def notice_for(assessment: SafetyAssessment) -> str | None:
    """The notice a client must show alongside the answer, or None.

    None for a crisis too: that path has its own response and no astrology
    to caveat.
    """
    if assessment.crisis:
        return None
    if assessment.professional_domains:
        return PROFESSIONAL_NOTICE
    if assessment.high_stakes:
        return CERTAINTY_NOTICE
    return None


#: No astrology, no model, no chart. The person said something that matters
#: more than a reading, and a chart is the wrong tool for it. No specific
#: helpline is named: a number that is right in one country is wrong in
#: another, and this API does not know where the person is.
CRISIS_RESPONSE = (
    "I'm really sorry you're going through this. What you're describing "
    "matters far more than anything a chart can say, and I'm not the right "
    "support for it. Please reach out to your local emergency services or a "
    "crisis helpline in your country right now, or tell someone you trust how "
    "you're feeling. You don't have to face this alone."
)

UNSUPPORTED_RESPONSE = (
    "That's outside what I can help with - I'm here to talk about astrology "
    "and your chart. Try asking about your placements, a transit, or a "
    "reading."
)

SAFE_FALLBACK_CHAT = (
    "I'm not able to answer that in a way I can stand behind. Astrology is an "
    "interpretive tradition - it can't predict outcomes or tell you what to "
    "decide. If you'd like, ask about the themes and placements in your "
    "chart instead, and we can reflect on those together."
)

SAFE_FALLBACK_READING = (
    "I'm not able to put together a reading I can stand behind right now. "
    "Please try again shortly."
)


# --- After generation: what the model said --------------------------------

#: Language that asserts rather than interprets (product spec §1: never
#: guarantees; engineering spec §30: "does not claim certainty").
_CERTAINTY_PATTERNS = tuple(
    _rx(p)
    for p in (
        r"\bguarantee[sd]?\b",
        r"\b(?:will|shall)\s+(?:definitely|certainly|surely|absolutely"
        r"|undoubtedly|inevitably)\b",
        r"\b(?:definitely|certainly|surely|undoubtedly|inevitably)\s+"
        r"(?:will|going\s+to)\b",
        r"\b(?:destined|fated)\s+to\b",
        r"\b100\s?%\s+(?:certain|sure|guaranteed|accurate)\b",
        r"\bwithout\s+(?:a\s+|any\s+)?doubt\b",
        r"\bis\s+(?:certain|sure)\s+to\b",
    )
)

#: High-risk decision framing: telling a person to act on a major decision
#: on astrology's say-so, or away from professional help. A few clear
#: examples of the class, not a complete list.
_RISKY_DIRECTIVE_PATTERNS = tuple(
    _rx(p)
    for p in (
        r"\b(?:stop|quit|skip|discontinue)\s+(?:taking\s+)?(?:your|the)\s+"
        r"(?:medication|medicine|prescription|pills|treatment)\b",
        r"\b(?:no\s+need|(?:don't|do\s+not)\s+need)\s+to\s+"
        r"(?:see|consult|visit|call|hire)\s+(?:a|an|the)\s+"
        r"(?:doctor|physician|lawyer|attorney|therapist|professional"
        r"|(?:financial\s+)?advis[eo]r)\b",
        r"\binstead\s+of\s+(?:seeing|consulting|visiting|hiring)\s+"
        r"(?:a|an|your)\s+(?:doctor|physician|lawyer|attorney|therapist"
        r"|advis[eo]r)\b",
        r"\byou\s+(?:should|must|need\s+to)\s+(?:definitely\s+|absolutely\s+"
        r"|certainly\s+)?(?:quit|resign\s+from)\s+(?:your|the)\s+job\b",
        r"\byou\s+(?:should|must|need\s+to)\s+(?:definitely\s+|absolutely\s+"
        r"|certainly\s+)?(?:invest|divorce|leave\s+(?:your|him|her))\b",
        r"\b(?:go\s+ahead\s+and|now\s+is\s+the\s+time\s+to)\s+"
        r"(?:invest|quit|divorce|sign)\b",
    )
)

_NEGATORS = _rx(
    r"\b(?:no|not|never|cannot|neither|nor|nothing|without|avoid|"
    r"rather\s+than)\b|n't\b"
)
_CLAUSE_BREAK = re.compile(r"[.,;:!?\n]")


def _asserted(pattern: re.Pattern[str], text: str) -> bool:
    """Whether `pattern` matches somewhere it is *asserted*, not negated.

    "I can't guarantee anything" and "there is no guarantee" are exactly
    what a careful answer says, so a bare `guarantee` match would flag the
    behaviour being asked for. A match counts only if no negator precedes
    it within its own clause - cut at the last punctuation mark, so
    "I can't say much, but you will definitely thrive" is still caught.
    """
    for match in pattern.finditer(text):
        window = text[max(0, match.start() - 60) : match.start()]
        clause = _CLAUSE_BREAK.split(window)[-1]
        if not _NEGATORS.search(clause):
            return True
    return False


def check_output(text: str) -> tuple[str, ...]:
    """Flags raised by a model response; empty means it passed.

    `certainty_claim` and `risky_directive`. Disclaimers are not checked
    here: they are not left to the model at all, but returned as a fixed
    notice (`notice_for`), which is a stronger guarantee than scanning the
    answer for wording that happens to resemble one.
    """
    normalised = _normalise(text)
    flags: list[str] = []
    if any(_asserted(p, normalised) for p in _CERTAINTY_PATTERNS):
        flags.append("certainty_claim")
    if any(_asserted(p, normalised) for p in _RISKY_DIRECTIVE_PATTERNS):
        flags.append("risky_directive")
    return tuple(flags)
