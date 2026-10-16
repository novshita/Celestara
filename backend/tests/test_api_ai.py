"""The AI Guide endpoint.

Never calls the real Anthropic API - `app.services.ai.service.anthropic.
Anthropic` is patched in every test, so these exercise everything around the
actual model call (grounding, error mapping, request validation) without
spending money or needing a real API key.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx2
import pytest
from fastapi.testclient import TestClient

from app.main import app

URL = "/api/v1/ai/chat"

EXACT_BIRTH = {
    "birth_date": "1990-08-15",
    "birth_time": "14:30:00",
    "time_confidence": "EXACT",
    "latitude": 18.9756,
    "longitude": 72.8258,
    "timezone_name": "Asia/Kolkata",
}

UNKNOWN_TIME_BIRTH = {
    "birth_date": "1990-08-15",
    "time_confidence": "UNKNOWN",
    "latitude": 18.9756,
    "longitude": 72.8258,
}


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _text_response(text: str, stop_reason: str = "end_turn") -> MagicMock:
    block = MagicMock()
    block.type = "text"
    block.text = text

    response = MagicMock()
    response.stop_reason = stop_reason
    response.content = [block]
    return response


@pytest.fixture
def mock_claude():
    """Patches the SDK client; `mock_claude.messages.create` is the call
    under test's control - set `.return_value` or `.side_effect` per test."""
    with patch("app.services.ai.service.anthropic.Anthropic") as mock_cls:
        mock_client = MagicMock()
        mock_cls.return_value = mock_client
        yield mock_client


def _ask(client, mock_claude, birth=None, system="vedic", question="Tell me about my chart."):
    mock_claude.messages.create.return_value = _text_response(
        "Your chart shows a thoughtful, grounded temperament."
    )
    return client.post(
        URL,
        json={"birth": birth or EXACT_BIRTH, "system": system, "question": question},
    )


# --- Success ----------------------------------------------------------


def test_answers_grounded_in_the_requested_system(client, mock_claude):
    response = _ask(client, mock_claude, system="vedic")

    assert response.status_code == 200
    body = response.json()
    assert body["system_used"] == "vedic"
    assert body["answer"] == "Your chart shows a thoughtful, grounded temperament."
    assert body["model"]


def test_western_system_is_calculated_and_passed_to_claude(client, mock_claude):
    _ask(client, mock_claude, system="western")

    call = mock_claude.messages.create.call_args
    content = call.kwargs["messages"][0]["content"]
    assert "System: Western" in content
    assert "CALCULATED FACTS" in content
    assert "USER QUESTION" in content


def test_compare_system_includes_the_ayanamsa(client, mock_claude):
    _ask(client, mock_claude, system="compare")

    content = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "Ayanamsa" in content
    assert "sign(s) apart" in content


def test_vedic_context_includes_calculated_placements(client, mock_claude):
    _ask(client, mock_claude, system="vedic")

    content = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "Grahas:" in content
    assert "Sun:" in content


def test_question_text_reaches_the_model(client, mock_claude):
    _ask(client, mock_claude, question="What does my rising sign mean?")

    content = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "What does my rising sign mean?" in content


def test_system_prompt_states_the_non_negotiables(client, mock_claude):
    _ask(client, mock_claude)

    system_prompt = mock_claude.messages.create.call_args.kwargs["system"]
    assert "never calculate astrology" in system_prompt
    assert "medical, legal, or financial advice" in system_prompt


def test_unknown_birth_time_is_accepted(client, mock_claude):
    response = _ask(client, mock_claude, birth=UNKNOWN_TIME_BIRTH, system="vedic")

    assert response.status_code == 200
    content = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "Assumptions:" in content


def test_defaults_to_vedic_when_system_is_omitted(client, mock_claude):
    mock_claude.messages.create.return_value = _text_response("An answer.")
    response = client.post(URL, json={"birth": EXACT_BIRTH, "question": "Hello?"})

    assert response.status_code == 200
    assert response.json()["system_used"] == "vedic"


# --- Refusal ----------------------------------------------------------


def test_refusal_is_turned_into_a_gentle_decline(client, mock_claude):
    mock_claude.messages.create.return_value = _text_response(
        "", stop_reason="refusal"
    )
    response = client.post(
        URL, json={"birth": EXACT_BIRTH, "system": "vedic", "question": "..."}
    )

    assert response.status_code == 200
    assert "not able to answer" in response.json()["answer"]


# --- Provider failures --------------------------------------------------


def _httpx_response(status_code: int) -> httpx2.Response:
    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    return httpx2.Response(status_code, request=request)


def test_rate_limit_is_reported_as_ai_unavailable(client, mock_claude):
    import anthropic

    mock_claude.messages.create.side_effect = anthropic.RateLimitError(
        "rate limited", response=_httpx_response(429), body=None
    )
    response = client.post(
        URL, json={"birth": EXACT_BIRTH, "system": "vedic", "question": "..."}
    )

    assert response.status_code == 503
    assert response.json()["code"] == "AI_UNAVAILABLE"


def test_connection_failure_is_reported_as_ai_unavailable(client, mock_claude):
    import anthropic

    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    mock_claude.messages.create.side_effect = anthropic.APIConnectionError(
        message="could not connect", request=request
    )
    response = client.post(
        URL, json={"birth": EXACT_BIRTH, "system": "vedic", "question": "..."}
    )

    assert response.status_code == 503
    assert response.json()["code"] == "AI_UNAVAILABLE"


def test_unexpected_sdk_failure_is_still_ai_unavailable_not_a_bare_500(
    client, mock_claude
):
    """Regression guard: an unset ANTHROPIC_API_KEY makes the real SDK raise
    a plain `TypeError` while building the request - before any of the
    three typed `anthropic.*Error` cases apply. Confirmed by running the
    real server with no key configured at all."""
    mock_claude.messages.create.side_effect = TypeError(
        "Could not resolve authentication method"
    )
    response = client.post(
        URL, json={"birth": EXACT_BIRTH, "system": "vedic", "question": "..."}
    )

    assert response.status_code == 503
    assert response.json()["code"] == "AI_UNAVAILABLE"


def test_provider_error_message_is_not_leaked(client, mock_claude):
    import anthropic

    mock_claude.messages.create.side_effect = anthropic.APIStatusError(
        "internal provider detail that must not reach the client",
        response=_httpx_response(500),
        body=None,
    )
    response = client.post(
        URL, json={"birth": EXACT_BIRTH, "system": "vedic", "question": "..."}
    )

    assert response.status_code == 503
    assert "internal provider detail" not in response.text


# --- Validation and docs ----------------------------------------------


def test_invalid_birth_data_is_rejected(client, mock_claude):
    response = client.post(
        URL,
        json={
            "birth": {**EXACT_BIRTH, "latitude": 91.0},
            "system": "vedic",
            "question": "...",
        },
    )

    assert response.status_code == 422


def test_empty_question_is_rejected(client, mock_claude):
    response = client.post(
        URL, json={"birth": EXACT_BIRTH, "system": "vedic", "question": ""}
    )

    assert response.status_code == 422


def test_invalid_system_is_rejected(client, mock_claude):
    response = client.post(
        URL, json={"birth": EXACT_BIRTH, "system": "numerology", "question": "..."}
    )

    assert response.status_code == 422


def test_endpoint_is_documented_with_examples(client):
    schema = client.get("/openapi.json").json()

    assert URL in schema["paths"]
    request_schema = schema["components"]["schemas"]["AiChatRequest"]
    assert "examples" in request_schema
