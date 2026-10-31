"""The AI layer: grounded question-answering and generated readings.

Deliberately the smallest useful slice of engineering spec §13-16's AI
orchestration layer. No RAG (§17) and no persisted conversation (§19's
`Conversation`/`ConversationMessage`/`Memory`) yet - both are separate,
later features once the decisions they need (a knowledge source to index;
a conversation data model) have actually been made. Everything here grounds
one request in already-calculated data and produces one piece of text -
nothing is stored, and nothing recomputes a position.

Product spec §1: "The system calculates. The AI interprets. The user
decides." This module is the second sentence only - the chart or transit
data it is given is exactly what `/charts/*` or `/transits/*` would have
returned for the same birth data.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from datetime import datetime

import anthropic

from app.core.config import DEFAULT_CALCULATION_CONFIG, CalculationConfig
from app.domain.ai import Intent, ReadingTopic
from app.core.metrics import AI_CALLS, AI_DURATION, SAFETY_EVENTS
from app.domain.birth_data import BirthData
from app.services.ai.context import (
    format_compare_context,
    format_period_transit_context,
    format_topic_focus,
    format_transit_reading_context,
    format_vedic_context,
    format_western_context,
)
from app.services.ai.intent import classify_intent
from app.services.ai.safety import (
    CRISIS_RESPONSE,
    SAFE_FALLBACK_CHAT,
    SAFE_FALLBACK_READING,
    UNSUPPORTED_RESPONSE,
    assess_question,
    check_output,
    notice_for,
    safety_context,
)
from app.services.astrology.compare.service import calculate_comparison
from app.services.astrology.transit.period import calculate_period_transits
from app.services.astrology.transit.service import calculate_transits
from app.services.astrology.vedic.d1 import calculate_d1_chart
from app.services.astrology.western.chart import calculate_western_chart

#: Claude Opus 5.5 unless the deployment overrides it - a per-answer chat
#: reply doesn't need Opus-tier reasoning on every request, but defaulting
#: down to save cost is a call for whoever runs this deployment to make via
#: this env var, not something to decide silently in code.
DEFAULT_MODEL = "claude-opus-5-5"

#: Generous for a chart-grounded answer without inviting an essay; raise if
#: real answers are getting cut off (see stop_reason == "max_tokens").
MAX_ANSWER_TOKENS = 2048

_SYSTEM_PROMPT = """\
You are Celestara's AI Guide: a calm celestial guide, not a cartoon \
character. Every answer must follow these non-negotiable rules:

1. You never calculate astrology. Every planetary position, house, aspect, \
nakshatra, and sign below was already produced by a deterministic \
calculation engine and is given to you as ground truth. Do not recompute, \
estimate, correct, or second-guess any of it. If a fact you would need is \
not present in what follows, say that it is not available - never invent \
a plausible-sounding one.
2. Never mix the Vedic (sidereal) and Western (tropical) frameworks into \
one calculation, and never claim one tradition is objectively more \
accurate than the other, including when both appear together in a \
comparison.
3. Never present astrology as scientifically validated prediction, and \
never guarantee a future outcome. Frame interpretation as a traditional, \
interpretive practice offered for reflection and exploration.
4. Never give medical, legal, or financial advice, and never treat \
astrology as a reliable basis for a major life decision. For a question \
like that: avoid certainty, explain the relevant interpretive factors, \
reframe toward reflection, and suggest the person seek qualified \
professional advice where relevant.
5. Show uncertainty, never hide it. If the facts below note an unavailable \
factor or an assumption (for example an unknown birth time), say so \
plainly rather than filling the gap yourself.
6. Stay inside astrology and this person's chart - you are not a \
general-purpose chatbot.

If a SAFETY CONTEXT section is present it takes priority over how the \
question is phrased. Follow the task instructions in each message, using \
only the calculated facts given there.\
"""


class AIProviderError(RuntimeError):
    """The AI provider could not be reached or declined the request.

    Covers every `anthropic` SDK failure mode (auth, rate limit, network,
    5xx) behind one type - the API layer's job is just "the AI guide isn't
    answering right now", not which SDK exception caused it.
    """


def _client() -> anthropic.Anthropic:
    # Credentials resolve from the environment (ANTHROPIC_API_KEY et al.) -
    # never read or logged by this module, so a key can never end up in an
    # error message (engineering spec §33: provider secrets stay server-side).
    return anthropic.Anthropic()


def current_model() -> str:
    """Which model answers requests, for the response's reproducibility
    metadata (engineering spec §10's "any result can be reproduced or
    explained later" applies to an AI answer's grounding, not only a chart)."""
    return os.getenv("ANTHROPIC_MODEL", DEFAULT_MODEL)


def _build_context(
    system: str, birth: BirthData, config: CalculationConfig
) -> str:
    if system == "western":
        return format_western_context(calculate_western_chart(birth, config))
    if system == "compare":
        return format_compare_context(calculate_comparison(birth, config))
    return format_vedic_context(calculate_d1_chart(birth, config))


def _create_message(user_content: str):
    """The provider call itself, with every SDK failure mode mapped to one
    `AIProviderError`."""
    try:
        return _client().messages.create(
            model=current_model(),
            max_tokens=MAX_ANSWER_TOKENS,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_content}],
        )
    except anthropic.RateLimitError as exc:
        raise AIProviderError("rate limited by the AI provider") from exc
    except anthropic.APIStatusError as exc:
        raise AIProviderError(f"AI provider returned {exc.status_code}") from exc
    except anthropic.APIConnectionError as exc:
        raise AIProviderError("could not reach the AI provider") from exc
    except Exception as exc:
        # Catches what the three specific cases above don't: most notably,
        # an unset ANTHROPIC_API_KEY makes the SDK raise a plain `TypeError`
        # while building the request, before any network call is attempted
        # or a typed `anthropic.*Error` exists to catch. Anything that can
        # go wrong calling the provider belongs to the provider's
        # availability, not this endpoint's internal correctness, so it is
        # still an `AIProviderError` and not a bare 500.
        raise AIProviderError("AI provider call failed") from exc


def _call_claude(user_content: str, declined_message: str) -> str:
    """Send one grounded prompt to Claude and return its text.

    Shared by every AI-layer entry point (chat, readings, and whatever is
    added next): the failure handling, model selection, and refusal
    fallback are identical regardless of what task the user content asks
    for - only the prompt itself differs per caller.
    """
    started = time.perf_counter()
    try:
        response = _create_message(user_content)
    except AIProviderError:
        AI_CALLS.labels("provider_error").inc()
        raise
    finally:
        AI_DURATION.observe(time.perf_counter() - started)
    AI_CALLS.labels("ok").inc()

    if response.stop_reason == "refusal":
        return declined_message

    return next(
        (block.text for block in response.content if block.type == "text"), ""
    )


@dataclass(frozen=True)
class ChatResult:
    """What `answer_question` decided and produced.

    `model_used` is False for the two answers that never reach the model - a
    crisis and an off-topic request - so the API can say so honestly instead
    of naming a model that wrote nothing.
    """

    answer: str
    intent: Intent
    notice: str | None
    safety_flags: tuple[str, ...]
    model_used: bool


def answer_question(
    birth: BirthData,
    system: str,
    question: str,
    config: CalculationConfig = DEFAULT_CALCULATION_CONFIG,
) -> ChatResult:
    """Ground `question` in the requested chart system and ask Claude, with
    the safety pipeline (engineering spec §30) around the model call.

    Raises whatever the underlying chart calculation raises (the same
    `InvalidBirthDataError`/`EphemerisError` paths as `/charts/*`) for a bad
    birth record, and `AIProviderError` if the model itself cannot be
    reached - the two are deliberately not conflated, since the first means
    the request was bad and the second means an upstream dependency is down.

    The two short-circuits run before any chart is calculated. A crisis must
    never be held up by, or turned into, a birth-data error; an off-topic
    request has no use for a chart.
    """
    assessment = assess_question(question)
    intent = classify_intent(question, system, assessment)

    if assessment.crisis:
        SAFETY_EVENTS.labels("crisis").inc()
        return ChatResult(
            answer=CRISIS_RESPONSE,
            intent=Intent.HIGH_STAKES,
            notice=None,
            safety_flags=("crisis",),
            model_used=False,
        )

    if intent is Intent.UNSUPPORTED:
        SAFETY_EVENTS.labels("unsupported").inc()
        return ChatResult(
            answer=UNSUPPORTED_RESPONSE,
            intent=intent,
            notice=None,
            safety_flags=(),
            model_used=False,
        )

    chart_context = _build_context(system, birth, config)
    safety_block = safety_context(assessment)
    safety_section = f"SAFETY CONTEXT\n{safety_block}\n\n" if safety_block else ""
    user_content = (
        f"TASK\nAnswer the user's question using only the calculated facts "
        f"below.\n\n{safety_section}CALCULATED FACTS\n{chart_context}\n\n"
        f"USER QUESTION\n{question}"
    )
    answer = _call_claude(
        user_content,
        declined_message=(
            "I'm not able to answer that one. Feel free to rephrase the "
            "question, or ask something else about this chart."
        ),
    )

    # Post-generation: whatever the model said, an answer that asserts
    # certainty or tells someone how to decide gets replaced, not shown.
    flags = check_output(answer)
    if flags:
        SAFETY_EVENTS.labels("output_replaced").inc()
        answer = SAFE_FALLBACK_CHAT

    return ChatResult(
        answer=answer,
        intent=intent,
        notice=notice_for(assessment),
        safety_flags=flags,
        model_used=True,
    )


#: Shared declined-message for every reading period - distinguished from
#: the chat one since there's no question to rephrase, only a retry.
_READING_DECLINED_MESSAGE = (
    "I'm not able to generate a reading right now. Please try again shortly."
)

#: One task instruction per period. Daily reads today's positions; weekly
#: and monthly are given what actually changes across the period (rashi
#: changes and retrograde/direct turns, from `calculate_period_transits`),
#: and are told to stay within it rather than guess at anything further.
_PERIOD_DAYS = {"weekly": 7, "monthly": 30}

_READING_TASKS: dict[str, str] = {
    "daily": (
        "Write a short daily reading (3-5 sentences) for this person, "
        "grounded only in the calculated facts below. Mention one or two "
        "transits that stand out today rather than listing everything. "
        "Keep the tone calm and reflective, not predictive."
    ),
    "weekly": (
        "Write a short reading for the week ahead (4-6 sentences) for this "
        "person, grounded only in the calculated facts below: today's "
        "transiting positions and the changes listed for the coming days. "
        "Build it around those changes, in the order they happen, saying "
        "roughly when each falls. If there are none, say the week is "
        "steady and describe the standing positions instead. Never mention "
        "a change that is not listed. Keep the tone calm and reflective, "
        "not predictive."
    ),
    "monthly": (
        "Write a short reading for the month ahead (4-6 sentences) for "
        "this person, grounded only in the calculated facts below: today's "
        "transiting positions and the changes listed for the coming month. "
        "Build it around the most significant of those changes (the "
        "slower grahas matter most), in the order they happen, saying "
        "roughly when each falls. If there are none, say the month is "
        "steady and describe the standing positions instead. Never "
        "mention a change that is not listed. Keep the tone calm and "
        "reflective, not predictive."
    ),
}


@dataclass(frozen=True)
class ReadingResult:
    """A generated reading, the moment it was grounded in (None for a
    birth-chart reading, which is grounded in no moment but the birth), and
    whether the safety backstop had to replace it."""

    reading: str
    generated_for: datetime | None
    safety_flags: tuple[str, ...]


def _generate_transit_reading(
    birth: BirthData,
    config: CalculationConfig,
    period: str,
    topic: ReadingTopic | None = None,
) -> ReadingResult:
    """Shared by `generate_daily_reading`/`generate_weekly_reading`/
    `generate_monthly_reading` - product spec §13: "Daily readings use
    current calculated planetary/transit data," and "should not generate
    readings from static templates alone when current transit data is
    relevant." The transit calculation is identical to `/transits/vedic` -
    same function, same "now" moment resolution - so none of the three is
    ever grounded in stale data.

    Weekly and monthly additionally look ahead 7 and 30 days for rashi
    changes and retrograde/direct turns, so they describe what really
    changes rather than restating today's snapshot.

    `generated_for` lets the API response report exactly which quantised
    moment the reading was grounded in (the start of the period), without
    recomputing the transit snapshot a second time.

    There is no user text to screen before generation - the task is fixed -
    but the output backstop still applies: a reading that asserts certainty
    breaks the same rule a chat answer would.
    """
    if period in _PERIOD_DAYS:
        period_report = calculate_period_transits(
            birth, _PERIOD_DAYS[period], config=config
        )
        context = format_period_transit_context(period_report)
        generated_for = period_report.start.snapshot.moment
    else:
        report = calculate_transits(birth, config=config)
        context = format_transit_reading_context(report)
        generated_for = report.snapshot.moment

    task = _READING_TASKS[period]
    if topic is not None:
        # A topic reading needs the natal bhavas the focus talks about, which
        # the transit snapshot only carries in part.
        task += "\n\n" + format_topic_focus(topic)
        context += "\n\nNatal chart:\n" + format_vedic_context(
            calculate_d1_chart(birth, config)
        )
    return _finish_reading(task, context, generated_for)


def _finish_reading(
    task: str, context: str, generated_for: datetime | None
) -> ReadingResult:
    """Generate from a prepared task and facts, then apply the backstop."""
    user_content = f"TASK\n{task}\n\nCALCULATED FACTS\n{context}"
    reading = _call_claude(user_content, declined_message=_READING_DECLINED_MESSAGE)

    flags = check_output(reading)
    if flags:
        SAFETY_EVENTS.labels("output_replaced").inc()
        reading = SAFE_FALLBACK_READING

    return ReadingResult(reading=reading, generated_for=generated_for, safety_flags=flags)


def generate_daily_reading(
    birth: BirthData,
    config: CalculationConfig = DEFAULT_CALCULATION_CONFIG,
    topic: ReadingTopic | None = None,
) -> ReadingResult:
    """The daily reading from product spec §13's list, optionally focused
    on a topic. Follow-up questions are a separate, later feature."""
    return _generate_transit_reading(birth, config, "daily", topic)


def generate_weekly_reading(
    birth: BirthData,
    config: CalculationConfig = DEFAULT_CALCULATION_CONFIG,
    topic: ReadingTopic | None = None,
) -> ReadingResult:
    """The weekly reading from product spec §13's list."""
    return _generate_transit_reading(birth, config, "weekly", topic)


def generate_monthly_reading(
    birth: BirthData,
    config: CalculationConfig = DEFAULT_CALCULATION_CONFIG,
    topic: ReadingTopic | None = None,
) -> ReadingResult:
    """The monthly reading from product spec §13's list."""
    return _generate_transit_reading(birth, config, "monthly", topic)


_CATEGORY_TASK = (
    "Write a short reading (4-6 sentences) on the focus given below, "
    "grounded only in the calculated facts below: this person's natal "
    "chart and today's transits. Mention one or two placements that "
    "stand out. Keep the tone calm and reflective, not predictive."
)

_BIRTH_CHART_TASK = (
    "Write a short reading (5-7 sentences) of this person's birth chart "
    "as a whole, grounded only in the calculated facts below: the "
    "Ascendant, the Moon, the Sun, and one or two other placements that "
    "stand out. Describe temperament and themes, not events. Keep the "
    "tone calm and reflective, not predictive."
)


def generate_topic_reading(
    birth: BirthData,
    topic: ReadingTopic,
    config: CalculationConfig = DEFAULT_CALCULATION_CONFIG,
) -> ReadingResult:
    """A category reading from product spec §13's list: birth chart,
    career, love, relationships, or personal growth.

    Birth chart reads the natal chart alone. The four life areas read the
    natal chart together with today's transits, focused on the bhavas and
    grahas traditionally tied to that area.
    """
    if topic is ReadingTopic.BIRTH_CHART:
        context = format_vedic_context(calculate_d1_chart(birth, config))
        return _finish_reading(_BIRTH_CHART_TASK, context, None)

    report = calculate_transits(birth, config=config)
    context = (
        "Natal chart:\n"
        + format_vedic_context(calculate_d1_chart(birth, config))
        + "\n\nCurrent transits:\n"
        + format_transit_reading_context(report)
    )
    task = _CATEGORY_TASK + "\n\n" + format_topic_focus(topic)
    return _finish_reading(task, context, report.snapshot.moment)
