"""Safety pipeline and intent classification.

Unit tests on the pure text functions, then API tests (Anthropic patched, as
in test_api_ai.py) for the behaviour wired around the model call.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.domain.ai import Intent, SafetyCategory
from app.main import app
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

CHAT = "/api/v1/ai/chat"
BIRTH = {
    "birth_date": "1990-08-15",
    "birth_time": "14:30:00",
    "time_confidence": "EXACT",
    "latitude": 18.9756,
    "longitude": 72.8258,
    "timezone_name": "Asia/Kolkata",
}


def _cats(question: str) -> set[SafetyCategory]:
    return set(assess_question(question).categories)


# --- assess_question ---------------------------------------------------


@pytest.mark.parametrize(
    "question",
    ["I want to kill myself", "thinking about suicide", "I want to die", "I keep wanting to hurt myself"],
)
def test_crisis_is_detected(question):
    assert assess_question(question).crisis


@pytest.mark.parametrize(
    ("question", "category"),
    [
        ("Will my cancer be cured?", SafetyCategory.MEDICAL),
        ("Should I stop taking my medication?", SafetyCategory.MEDICAL),
        ("Will my mother's cancer be cured?", SafetyCategory.MEDICAL),
        ("Will I win my lawsuit?", SafetyCategory.LEGAL),
        ("Should I invest in stocks now?", SafetyCategory.FINANCIAL),
        ("Should I quit my job?", SafetyCategory.MAJOR_LIFE_DECISION),
        ("Should I get a divorce?", SafetyCategory.MAJOR_LIFE_DECISION),
        ("Will I definitely get married?", SafetyCategory.CERTAINTY_SEEKING),
    ],
)
def test_categories_are_detected(question, category):
    assert category in _cats(question)


@pytest.mark.parametrize(
    "question",
    [
        "What does my Moon in Cancer mean?",
        "Explain the Saturn return.",
        "What is my rising sign?",
        "Tell me about my chart.",
        "How does the Vimshottari dasha work?",
        "Cancer rising and a Leo Sun - what does that say?",
        "I'm a Cancer, what does that say about me?",
    ],
)
def test_ordinary_astrology_questions_are_not_flagged(question):
    assessment = assess_question(question)
    assert assessment.categories == ()
    assert not assessment.high_stakes


def test_crisis_is_not_treated_as_a_professional_domain():
    assessment = assess_question("I want to kill myself")
    assert assessment.professional_domains == ()
    assert safety_context(assessment) == ""
    assert notice_for(assessment) is None


def test_safety_context_and_notice_for_professional_domains():
    assessment = assess_question("Should I stop taking my medication?")
    context = safety_context(assessment)
    assert context
    assert "consult" in context.lower()
    assert notice_for(assessment)


def test_nothing_to_add_for_an_ordinary_question():
    assessment = assess_question("What does my Sun sign mean?")
    assert safety_context(assessment) == ""
    assert notice_for(assessment) is None


def test_certainty_seeking_alone_gets_a_notice():
    assessment = assess_question("Will I definitely become rich?")
    assert notice_for(assessment)


# --- check_output ------------------------------------------------------


@pytest.mark.parametrize(
    "text",
    [
        "You will definitely get the promotion.",
        "This is guaranteed to bring you wealth.",
        "You should stop taking your medication.",
        "You must divorce him.",
    ],
)
def test_output_checker_flags_unsafe_text(text):
    assert check_output(text)


@pytest.mark.parametrize(
    "text",
    [
        "Your Moon in Cancer suggests an emotional, caring temperament.",
        "I can't guarantee anything; astrology cannot predict outcomes.",
        "Nothing here is certain, and I would not tell you to quit your job.",
        "Saturn's placement points to themes of discipline you may want to reflect on.",
    ],
)
def test_output_checker_passes_safe_text(text):
    assert check_output(text) == ()


def test_negation_does_not_leak_across_clauses():
    assert check_output("I can't say much, but you will definitely thrive.")


# --- classify_intent ---------------------------------------------------


@pytest.mark.parametrize(
    ("question", "system", "intent"),
    [
        ("Should I quit my job?", "vedic", Intent.HIGH_STAKES),
        ("Write me a python script to sort a list", "vedic", Intent.UNSUPPORTED),
        ("What is 2 + 2?", "vedic", Intent.UNSUPPORTED),
        ("What is the difference between Vedic and Western astrology?", "compare", Intent.COMPARE_QUESTION),
        ("What is a nakshatra?", "vedic", Intent.GENERAL_EDUCATION),
        ("Explain what a trine is", "western", Intent.GENERAL_EDUCATION),
        ("Which dasha am I in?", "vedic", Intent.DASHA_QUESTION),
        ("What is Saturn transiting for me?", "vedic", Intent.TRANSIT_QUESTION),
        ("Give me my horoscope for this week", "western", Intent.READING_REQUEST),
        ("What does my Moon mean to me?", "western", Intent.PLANET_EXPLORATION),
        ("Tell me about my chart", "vedic", Intent.BIRTH_CHART_EXPLANATION),
        ("Anything interesting?", "vedic", Intent.VEDIC_QUESTION),
        ("Anything interesting?", "western", Intent.WESTERN_QUESTION),
        ("Anything interesting?", "compare", Intent.COMPARE_QUESTION),
    ],
)
def test_intent_classification(question, system, intent):
    assert classify_intent(question, system) == intent


def test_astrology_wording_stops_a_question_being_called_off_topic():
    # "write" + "email" is an off-topic cue, but a chart question stays on topic.
    assert classify_intent("Write an email about my Saturn transit", "vedic") != Intent.UNSUPPORTED


# --- API ---------------------------------------------------------------


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def mock_claude():
    with patch("app.services.ai.service.anthropic.Anthropic") as mock_cls:
        client = MagicMock()
        mock_cls.return_value = client
        yield client


def _reply(text: str) -> MagicMock:
    block = MagicMock()
    block.type = "text"
    block.text = text
    response = MagicMock()
    response.stop_reason = "end_turn"
    response.content = [block]
    return response


def _chat(client, question, system="vedic"):
    return client.post(CHAT, json={"birth": BIRTH, "system": system, "question": question})


def test_crisis_gets_fixed_text_and_no_model_call(client, mock_claude):
    response = _chat(client, "I want to kill myself")

    assert response.status_code == 200
    body = response.json()
    assert body["answer"] == CRISIS_RESPONSE
    assert body["model"] is None
    assert body["intent"] == "high_stakes"
    assert body["safety_flags"] == ["crisis"]
    mock_claude.messages.create.assert_not_called()


def test_crisis_is_never_rate_limited(client, mock_claude, monkeypatch):
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "1")
    mock_claude.messages.create.return_value = _reply("Fine.")

    assert _chat(client, "Tell me about my chart").status_code == 200
    assert _chat(client, "Tell me about my chart").status_code == 429
    assert _chat(client, "I want to die").status_code == 200


def test_off_topic_is_declined_without_a_model_call(client, mock_claude):
    response = _chat(client, "Write me a python script to sort a list")

    body = response.json()
    assert response.status_code == 200
    assert body["answer"] == UNSUPPORTED_RESPONSE
    assert body["model"] is None
    assert body["intent"] == "unsupported"
    mock_claude.messages.create.assert_not_called()


def test_high_stakes_question_gets_context_and_notice(client, mock_claude):
    mock_claude.messages.create.return_value = _reply("Traditionally, the 10th house relates to career.")

    response = _chat(client, "Should I quit my job?")

    body = response.json()
    assert body["intent"] == "high_stakes"
    assert body["notice"]
    content = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "SAFETY CONTEXT" in content


def test_benign_question_has_no_safety_context_or_notice(client, mock_claude):
    mock_claude.messages.create.return_value = _reply("Your Moon suggests a caring nature.")

    body = _chat(client, "What does my Moon mean?").json()

    assert body["notice"] is None
    assert body["safety_flags"] == []
    assert body["model"]
    content = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "SAFETY CONTEXT" not in content


def test_unsafe_model_output_is_replaced(client, mock_claude):
    mock_claude.messages.create.return_value = _reply("You will definitely get the job.")

    body = _chat(client, "What does my Sun mean?").json()

    assert body["answer"] == SAFE_FALLBACK_CHAT
    assert "certainty_claim" in body["safety_flags"]


@pytest.mark.parametrize("period", ["daily", "weekly", "monthly"])
def test_unsafe_reading_output_is_replaced(client, mock_claude, period):
    mock_claude.messages.create.return_value = _reply("You will definitely become rich.")

    response = client.post(f"/api/v1/readings/{period}", json={"birth": BIRTH})

    body = response.json()
    assert response.status_code == 200
    assert body["reading"] == SAFE_FALLBACK_READING
    assert body["safety_flags"]
