"""Operational metrics: what is counted, what is deliberately not, and who
can read it."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import metrics as metrics_route
from app.core.metrics import registry
from app.main import app

BIRTH = {
    "birth_date": "1990-08-15",
    "birth_time": "14:30:00",
    "time_confidence": "EXACT",
    "latitude": 18.9756,
    "longitude": 72.8258,
    "timezone_name": "Asia/Kolkata",
}


def sample(name: str, **labels) -> float:
    return registry.get_sample_value(name, labels) or 0.0


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def mock_claude():
    with patch("app.services.ai.service.anthropic.Anthropic") as mock_cls:
        mock_client = MagicMock()
        block = MagicMock()
        block.type = "text"
        block.text = "A calm, reflective answer."
        response = MagicMock()
        response.stop_reason = "end_turn"
        response.content = [block]
        mock_client.messages.create.return_value = response
        mock_cls.return_value = mock_client
        yield mock_client


def _chat(client, question):
    return client.post(
        "/api/v1/ai/chat", json={"birth": BIRTH, "system": "vedic", "question": question}
    )


# --- HTTP ---------------------------------------------------------------


def test_requests_are_counted_by_route_template_and_status(client):
    labels = dict(method="POST", route="/api/v1/charts/vedic", status="200")
    before = sample("celestara_http_requests_total", **labels)

    assert client.post("/api/v1/charts/vedic", json={"birth": BIRTH}).status_code == 200

    assert sample("celestara_http_requests_total", **labels) == before + 1
    assert sample(
        "celestara_http_request_duration_seconds_count",
        method="POST",
        route="/api/v1/charts/vedic",
    ) >= 1


def test_errors_are_counted_under_their_own_status(client):
    labels = dict(method="POST", route="/api/v1/charts/vedic", status="422")
    before = sample("celestara_http_requests_total", **labels)

    client.post("/api/v1/charts/vedic", json={"birth": {"birth_date": "nope"}})

    assert sample("celestara_http_requests_total", **labels) == before + 1


def test_unmatched_paths_share_one_label_instead_of_minting_series(client):
    labels = dict(method="GET", route="unmatched", status="404")
    before = sample("celestara_http_requests_total", **labels)

    client.get("/no/such/path/12345")
    client.get("/another/one/67890")

    assert sample("celestara_http_requests_total", **labels) == before + 2
    exposed = "".join(metric_family_text())
    assert "12345" not in exposed and "67890" not in exposed


def test_path_parameters_never_become_label_values(client):
    # Unauthenticated, so 401 - but the route still matched, with a real id.
    client.get("/api/v1/journal/987654")

    exposed = "".join(metric_family_text())
    assert "987654" not in exposed
    assert 'route="/api/v1/journal/{entry_id}"' in exposed


def metric_family_text():
    from prometheus_client import generate_latest

    yield generate_latest(registry).decode()


# --- AI and safety --------------------------------------------------------


def test_successful_and_failed_provider_calls_are_counted(client, mock_claude):
    ok = sample("celestara_ai_calls_total", outcome="ok")
    failed = sample("celestara_ai_calls_total", outcome="provider_error")

    _chat(client, "What does my Moon mean?")
    mock_claude.messages.create.side_effect = RuntimeError("down")
    _chat(client, "What does my Sun mean?")

    assert sample("celestara_ai_calls_total", outcome="ok") == ok + 1
    assert sample("celestara_ai_calls_total", outcome="provider_error") == failed + 1
    assert sample("celestara_ai_call_duration_seconds_count") >= 2


def test_safety_actions_are_counted(client, mock_claude):
    crisis = sample("celestara_safety_events_total", event="crisis")
    unsupported = sample("celestara_safety_events_total", event="unsupported")
    replaced = sample("celestara_safety_events_total", event="output_replaced")

    _chat(client, "I want to kill myself")
    _chat(client, "Write me a python script to sort a list")
    mock_claude.messages.create.return_value.content[0].text = "You will definitely be rich."
    _chat(client, "What does my Sun mean?")

    assert sample("celestara_safety_events_total", event="crisis") == crisis + 1
    assert sample("celestara_safety_events_total", event="unsupported") == unsupported + 1
    assert sample("celestara_safety_events_total", event="output_replaced") == replaced + 1


def test_rate_limited_requests_are_counted(client, mock_claude, monkeypatch):
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "1")
    before = sample("celestara_rate_limited_total")

    _chat(client, "What does my Moon mean?")
    assert _chat(client, "What does my Moon mean?").status_code == 429

    assert sample("celestara_rate_limited_total") == before + 1


def test_no_request_content_reaches_the_metrics(client, mock_claude):
    _chat(client, "A very distinctive question about my zebra-print destiny")

    from prometheus_client import generate_latest

    exposed = generate_latest(registry).decode()
    assert "zebra" not in exposed
    assert "1990-08-15" not in exposed


# --- the endpoint -------------------------------------------------------------


def test_metrics_endpoint_does_not_exist_unless_enabled(client):
    assert client.get("/metrics").status_code == 404


def _metrics_client() -> TestClient:
    mini = FastAPI()
    mini.include_router(metrics_route.router)
    return TestClient(mini)


def test_metrics_endpoint_serves_prometheus_text(monkeypatch):
    monkeypatch.delenv("METRICS_TOKEN", raising=False)

    response = _metrics_client().get("/metrics")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert "celestara_http_requests_total" in response.text


def test_metrics_endpoint_requires_the_token_when_one_is_set(monkeypatch):
    monkeypatch.setenv("METRICS_TOKEN", "s3cret")
    client = _metrics_client()

    assert client.get("/metrics").status_code == 401
    assert client.get("/metrics", headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert client.get("/metrics", headers={"Authorization": "Bearer s3cret"}).status_code == 200


@pytest.mark.parametrize(
    ("value", "enabled"),
    [("true", True), ("1", True), ("yes", True), ("false", False), ("", False), ("no", False)],
)
def test_metrics_enabled_flag(monkeypatch, value, enabled):
    monkeypatch.setenv("METRICS_ENABLED", value)
    assert metrics_route.metrics_enabled() is enabled


def test_metrics_is_hidden_from_the_api_docs(client):
    assert "/metrics" not in client.get("/openapi.json").json()["paths"]
