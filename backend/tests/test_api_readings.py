"""The daily/weekly/monthly reading endpoints.

Never calls the real Anthropic API - `app.services.ai.service.anthropic.
Anthropic` is patched in every test, same approach as `test_api_ai.py`.

Most tests are parametrized across all three periods, since they share one
request/response shape and one code path (`_generate_transit_reading`) -
the only thing that differs per period is the task instruction sent to
Claude, which `test_task_mentions_the_right_period` checks directly.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx2
import pytest
from fastapi.testclient import TestClient

from app.main import app

PERIODS = ["daily", "weekly", "monthly"]

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


def url_for(period: str) -> str:
    return f"/api/v1/readings/{period}"


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


def _get_reading(client, mock_claude, period: str, birth=None):
    mock_claude.messages.create.return_value = _text_response(
        "A grounded stretch ahead - take things one step at a time."
    )
    return client.post(url_for(period), json={"birth": birth or EXACT_BIRTH})


# --- Success, parametrized across all three periods ------------------


@pytest.mark.parametrize("period", PERIODS)
def test_returns_a_reading(client, mock_claude, period):
    response = _get_reading(client, mock_claude, period)

    assert response.status_code == 200
    body = response.json()
    assert body["reading"] == "A grounded stretch ahead - take things one step at a time."
    assert body["model"]
    assert body["generated_for"]


@pytest.mark.parametrize("period", PERIODS)
def test_grounded_in_todays_transits_not_a_template(client, mock_claude, period):
    _get_reading(client, mock_claude, period)

    content = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "Transits:" in content
    assert "Natal Ascendant:" in content


@pytest.mark.parametrize("period", PERIODS)
def test_unknown_birth_time_is_accepted(client, mock_claude, period):
    """Current transits don't depend on birth time - only the natal-relative
    framing is withheld, same as `/transits/vedic`."""
    response = _get_reading(client, mock_claude, period, birth=UNKNOWN_TIME_BIRTH)

    assert response.status_code == 200
    content = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
    assert "Unavailable:" in content


@pytest.mark.parametrize("period", PERIODS)
def test_system_prompt_states_the_non_negotiables(client, mock_claude, period):
    _get_reading(client, mock_claude, period)

    system_prompt = mock_claude.messages.create.call_args.kwargs["system"]
    assert "never calculate astrology" in system_prompt


@pytest.mark.parametrize("period", PERIODS)
def test_refusal_is_turned_into_a_gentle_decline(client, mock_claude, period):
    mock_claude.messages.create.return_value = _text_response(
        "", stop_reason="refusal"
    )
    response = client.post(url_for(period), json={"birth": EXACT_BIRTH})

    assert response.status_code == 200
    assert "not able to generate a reading" in response.json()["reading"]


@pytest.mark.parametrize("period", PERIODS)
def test_rate_limit_is_reported_as_ai_unavailable(client, mock_claude, period):
    import anthropic

    request = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
    mock_claude.messages.create.side_effect = anthropic.RateLimitError(
        "rate limited",
        response=httpx2.Response(429, request=request),
        body=None,
    )
    response = client.post(url_for(period), json={"birth": EXACT_BIRTH})

    assert response.status_code == 503
    assert response.json()["code"] == "AI_UNAVAILABLE"


@pytest.mark.parametrize("period", PERIODS)
def test_invalid_birth_data_is_rejected(client, mock_claude, period):
    response = client.post(
        url_for(period), json={"birth": {**EXACT_BIRTH, "latitude": 91.0}}
    )

    assert response.status_code == 422


@pytest.mark.parametrize("period", PERIODS)
def test_endpoint_is_documented(client, period):
    schema = client.get("/openapi.json").json()

    assert url_for(period) in schema["paths"]
    request_schema = schema["components"]["schemas"]["ReadingRequest"]
    assert "examples" in request_schema


# --- What's specific to each period ------------------------------------


@pytest.mark.parametrize(
    "period,expected_phrase",
    [
        ("daily", "daily reading"),
        ("weekly", "week ahead"),
        ("monthly", "month ahead"),
    ],
)
def test_task_mentions_the_right_period(
    client, mock_claude, period, expected_phrase
):
    _get_reading(client, mock_claude, period)

    content = mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]
    assert expected_phrase in content


def test_weekly_and_monthly_do_not_claim_to_forecast(client, mock_claude):
    """The honesty guard: both longer periods ground in today's transits,
    not a simulation of the period ahead, and the task instruction must say
    so rather than silently implying otherwise."""
    for period in ("weekly", "monthly"):
        _get_reading(client, mock_claude, period)
        content = mock_claude.messages.create.call_args.kwargs["messages"][0][
            "content"
        ]
        assert "do not claim to know what changes later" in content
