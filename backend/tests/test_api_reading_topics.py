"""Category readings (`/readings/topic/{topic}`) and topic-focused
daily/weekly/monthly readings. Anthropic is patched, as in the sibling
reading tests."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

BIRTH = {
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
LIFE_AREAS = ["career", "love", "relationships", "growth"]
ALL_TOPICS = ["birth_chart", *LIFE_AREAS]


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def mock_claude():
    with patch("app.services.ai.service.anthropic.Anthropic") as mock_cls:
        mock_client = MagicMock()
        block = MagicMock()
        block.type = "text"
        block.text = "A grounded, reflective reading."
        response = MagicMock()
        response.stop_reason = "end_turn"
        response.content = [block]
        mock_client.messages.create.return_value = response
        mock_cls.return_value = mock_client
        yield mock_client


def _sent(mock_claude) -> str:
    return mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]


def _topic(client, topic, birth=BIRTH):
    return client.post(f"/api/v1/readings/topic/{topic}", json={"birth": birth})


@pytest.mark.parametrize("topic", ALL_TOPICS)
def test_every_category_returns_a_reading(client, mock_claude, topic):
    response = _topic(client, topic)

    assert response.status_code == 200
    body = response.json()
    assert body["reading"] == "A grounded, reflective reading."
    assert body["model"]
    assert body["safety_flags"] == []


@pytest.mark.parametrize("topic", LIFE_AREAS)
def test_life_area_readings_use_natal_chart_transits_and_focus(client, mock_claude, topic):
    body = _topic(client, topic).json()

    sent = _sent(mock_claude)
    assert "Natal chart:" in sent
    assert "Current transits:" in sent
    assert "Focus on" in sent
    assert body["generated_for"] is not None


def test_each_life_area_has_its_own_focus(client, mock_claude):
    focuses = set()
    for topic in LIFE_AREAS:
        _topic(client, topic)
        focuses.add(_sent(mock_claude).split("Focus on", 1)[1].split(".", 1)[0])
    assert len(focuses) == len(LIFE_AREAS)


def test_birth_chart_reading_uses_the_natal_chart_alone(client, mock_claude):
    body = _topic(client, "birth_chart").json()

    sent = _sent(mock_claude)
    assert "Grahas:" in sent
    assert "transit" not in sent.lower()
    assert "Focus on" not in sent
    assert body["generated_for"] is None


def test_unknown_birth_time_is_still_readable_and_flagged_to_the_model(client, mock_claude):
    response = _topic(client, "career", UNKNOWN_TIME_BIRTH)

    assert response.status_code == 200
    assert "unavailable" in _sent(mock_claude).lower()


def test_unknown_topic_is_a_422(client, mock_claude):
    assert _topic(client, "money").status_code == 422
    mock_claude.messages.create.assert_not_called()


def test_invalid_birth_data_is_a_422(client, mock_claude):
    response = client.post("/api/v1/readings/topic/career", json={"birth": {"birth_date": "nope"}})
    assert response.status_code == 422


@pytest.mark.parametrize("topic", ALL_TOPICS)
def test_unsafe_category_output_is_replaced(client, mock_claude, topic):
    mock_claude.messages.create.return_value.content[0].text = "You will definitely be rich."

    body = _topic(client, topic).json()

    assert body["safety_flags"]
    assert "definitely" not in body["reading"]


def test_provider_failure_is_a_503(client, mock_claude):
    mock_claude.messages.create.side_effect = RuntimeError("down")
    assert _topic(client, "love").status_code == 503


# --- topic focus on daily / weekly / monthly ---------------------------


@pytest.mark.parametrize("period", ["daily", "weekly", "monthly"])
def test_period_reading_can_be_focused_on_a_topic(client, mock_claude, period):
    response = client.post(
        f"/api/v1/readings/{period}", json={"birth": BIRTH, "topic": "career"}
    )

    assert response.status_code == 200
    sent = _sent(mock_claude)
    assert "Focus on career" in sent
    assert "Natal chart:" in sent


@pytest.mark.parametrize("period", ["daily", "weekly", "monthly"])
def test_period_reading_without_a_topic_is_unchanged(client, mock_claude, period):
    client.post(f"/api/v1/readings/{period}", json={"birth": BIRTH})

    sent = _sent(mock_claude)
    assert "Focus on" not in sent
    assert "Natal chart:" not in sent


@pytest.mark.parametrize("period", ["daily", "weekly", "monthly"])
def test_birth_chart_is_not_a_period_topic(client, mock_claude, period):
    response = client.post(
        f"/api/v1/readings/{period}", json={"birth": BIRTH, "topic": "birth_chart"}
    )

    assert response.status_code == 422
    mock_claude.messages.create.assert_not_called()


def test_topic_readings_are_rate_limited(client, mock_claude, monkeypatch):
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "1")

    assert _topic(client, "career").status_code == 200
    assert _topic(client, "love").status_code == 429
