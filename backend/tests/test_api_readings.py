"""The daily reading endpoint.

Never calls the real Anthropic API - `app.services.ai.service.anthropic.
Anthropic` is patched in every test, same approach as `test_api_ai.py`.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx2
import pytest
from fastapi.testclient import TestClient

from app.main import app

URL = "/api/v1/readings/daily"

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
    with patch("app.services.ai.service.anthropic.Anthropic") as mock_cls:
        mock_client = MagicMock()
        mock_cls.return_value = mock_client
        yield mock_client


def _get_reading(client, mock_claude, birth=None):
    mock_claude.messages.create.return_value = _text_response(
        "A grounded day - take things one step at a time."
    )
    return client.post(URL, json={"birth": birth or EXACT_BIRTH})


# --- Success ----------------------------------------------------------


def test_returns_a_reading(client, mock_claude):
    response = _get_reading(client, mock_claude)

    assert response.status_code == 200
    body = response.json()
    assert body["reading"] == "A grounded day - take things one step at a time."
    assert body["model"]
    assert body["generated_for"]


def test_grounded_in_todays_transits_not_a_template(client, mock_claude):
    _get_reading(client, mock_claude)

    content = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "today's transits" in content
    assert "Transits:" in content
    assert "Natal Ascendant:" in content


def test_task_instructs_a_short_reflective_reading(client, mock_claude):
    _get_reading(client, mock_claude)

    content = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "daily reading" in content
    assert "not predictive" in content


def test_unknown_birth_time_is_accepted(client, mock_claude):
    """Current transits don't depend on birth time - only the natal-relative
    framing is withheld, same as `/transits/vedic`."""
    response = _get_reading(client, mock_claude, birth=UNKNOWN_TIME_BIRTH)

    assert response.status_code == 200
    content = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "Unavailable:" in content


def test_system_prompt_states_the_non_negotiables(client, mock_claude):
    _get_reading(client, mock_claude)

    system_prompt = mock_claude.messages.create.call_args.kwargs["system"]
    assert "never calculate astrology" in system_prompt


# --- Refusal and provider failures -----------------------------------


def test_refusal_is_turned_into_a_gentle_decline(client, mock_claude):
    mock_claude.messages.create.return_value = _text_response(
        "", stop_reason="refusal"
    )
    response = client.post(URL, json={"birth": EXACT_BIRTH})

    assert response.status_code == 200
    assert "not able to generate a reading" in response.json()["reading"]


def test_rate_limit_is_reported_as_ai_unavailable(client, mock_claude):
    import anthropic

    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    mock_claude.messages.create.side_effect = anthropic.RateLimitError(
        "rate limited",
        response=httpx2.Response(429, request=request),
        body=None,
    )
    response = client.post(URL, json={"birth": EXACT_BIRTH})

    assert response.status_code == 503
    assert response.json()["code"] == "AI_UNAVAILABLE"


# --- Validation and docs ----------------------------------------------


def test_invalid_birth_data_is_rejected(client, mock_claude):
    response = client.post(URL, json={"birth": {**EXACT_BIRTH, "latitude": 91.0}})

    assert response.status_code == 422


def test_endpoint_is_documented_with_examples(client):
    schema = client.get("/openapi.json").json()

    assert URL in schema["paths"]
    request_schema = schema["components"]["schemas"]["DailyReadingRequest"]
    assert "examples" in request_schema
