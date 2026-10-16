"""The AI Guide: a single grounded question-and-answer turn.

Deliberately the smallest useful slice of engineering spec §13-16's AI
orchestration layer. No RAG (§17) and no persisted conversation (§19's
`Conversation`/`ConversationMessage`/`Memory`) yet - both are separate,
later features once the decisions they need (a knowledge source to index;
a conversation data model) have actually been made. This endpoint only
grounds one question in one already-calculated chart and answers it.

Product spec §1: "The system calculates. The AI interprets. The user
decides." This module is the second sentence only - it never recomputes a
position, and the chart it is given is exactly what `/charts/*` would have
returned for the same birth data.
"""

from __future__ import annotations

import os

import anthropic

from app.core.config import DEFAULT_CALCULATION_CONFIG, CalculationConfig
from app.domain.birth_data import BirthData
from app.services.ai.context import (
    format_compare_context,
    format_vedic_context,
    format_western_context,
)
from app.services.astrology.compare.service import calculate_comparison
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

Answer the question using only the calculated facts given below.\
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


def answer_question(
    birth: BirthData,
    system: str,
    question: str,
    config: CalculationConfig = DEFAULT_CALCULATION_CONFIG,
) -> str:
    """Ground `question` in the requested chart system and ask Claude.

    Raises whatever the underlying chart calculation raises (the same
    `InvalidBirthDataError`/`EphemerisError` paths as `/charts/*`) for a bad
    birth record, and `AIProviderError` if the model itself cannot be
    reached - the two are deliberately not conflated, since the first means
    the request was bad and the second means an upstream dependency is down.
    """
    chart_context = _build_context(system, birth, config)
    user_content = (
        f"CALCULATED FACTS\n{chart_context}\n\nUSER QUESTION\n{question}"
    )

    try:
        response = _client().messages.create(
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

    if response.stop_reason == "refusal":
        return (
            "I'm not able to answer that one. Feel free to rephrase the "
            "question, or ask something else about this chart."
        )

    return next(
        (block.text for block in response.content if block.type == "text"), ""
    )
