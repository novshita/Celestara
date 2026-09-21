"""Request tracing and log hygiene.

Two requirements pull against each other here: spec §32 wants every request
traceable by id, and spec §20 forbids private birth data in logs. These tests
pin both - the id must always be present, the birth data must never be.
"""

from __future__ import annotations

import logging

import pytest
from fastapi.testclient import TestClient

from app.main import app

CHART_URL = "/api/v1/charts/vedic"

#: Distinctive values so a leak into the logs is unambiguous.
SENSITIVE_BIRTH = {
    "birth_date": "1973-11-07",
    "birth_time": "03:47:00",
    "time_confidence": "EXACT",
    "latitude": 12.971599,
    "longitude": 77.594566,
    "timezone_name": "Asia/Kolkata",
}


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def logs(caplog):
    """Capture the application logger at INFO."""
    caplog.set_level(logging.INFO, logger="celestara")
    return caplog


def _access_lines(logs) -> list[str]:
    return [
        record.getMessage()
        for record in logs.records
        if record.name.startswith("celestara.api.access")
    ]


# --- Every request is traceable -------------------------------------------


def test_successful_request_is_logged_with_its_id(client, logs):
    response = client.post(CHART_URL, json={"birth": SENSITIVE_BIRTH})
    request_id = response.headers["X-Request-Id"]

    assert response.status_code == 200
    assert any(request_id in line for line in _access_lines(logs)), (
        "a request id handed to a client must appear in the logs"
    )


@pytest.mark.parametrize(
    ("body", "expected_status"),
    [
        ({"birth": {**SENSITIVE_BIRTH, "latitude": 91.0}}, 422),
        ({"birth": {**SENSITIVE_BIRTH, "timezone_name": "Mars/Olympus"}}, 400),
        ({}, 422),
    ],
)
def test_failed_requests_are_logged_with_their_id(
    client, logs, body, expected_status
):
    """Regression: only 500s were logged, so a reported 422 id led nowhere."""
    response = client.post(CHART_URL, json=body)
    request_id = response.json()["request_id"]

    assert response.status_code == expected_status
    assert any(request_id in line for line in _access_lines(logs))


def test_client_supplied_id_is_the_one_logged(client, logs):
    """Lets a frontend trace its own request through the backend."""
    client.get("/health", headers={"X-Request-Id": "trace-me-4821"})

    assert any("trace-me-4821" in line for line in _access_lines(logs))


def test_log_line_records_method_path_and_status(client, logs):
    client.get("/health")

    line = next(l for l in _access_lines(logs) if "/health" in l)
    assert "GET" in line
    assert "200" in line


# --- Log hygiene ----------------------------------------------------------


def test_birth_data_never_reaches_the_logs(client, logs):
    """Spec §20: private birth data must not appear in logs.

    Checked against the whole captured log text rather than just the access
    lines, so a leak from any logger in the app would fail this.
    """
    client.post(CHART_URL, json={"birth": SENSITIVE_BIRTH})

    captured = logs.text

    for forbidden in ("1973-11-07", "03:47", "12.971599", "77.594566"):
        assert forbidden not in captured, (
            f"{forbidden!r} leaked into the logs"
        )


def test_calculated_positions_never_reach_the_logs(client, logs):
    """The chart itself is derived personal data and equally private."""
    response = client.post(CHART_URL, json={"birth": SENSITIVE_BIRTH})
    ascendant = response.json()["chart"]["ascendant"]

    assert str(round(ascendant["longitude"], 4)) not in logs.text


def test_engine_failure_logs_detail_but_response_does_not(
    client, logs, monkeypatch
):
    """The internal detail belongs in the log, not the response body."""
    from app.api.routes import charts
    from app.services.astrology.common.ephemeris import EphemerisError

    detail = "/internal/path/ephemeris"

    def boom(*args, **kwargs):
        raise EphemerisError(f"missing data files at {detail!r}")

    monkeypatch.setattr(charts, "calculate_d1_chart", boom)

    response = client.post(CHART_URL, json={"birth": SENSITIVE_BIRTH})

    assert detail not in response.text
    assert detail in logs.text
    assert response.json()["request_id"] in logs.text
