"""API routes.

Covers the contract the frontend will depend on: response shape, the typed
error vocabulary from engineering spec §29, and the guarantee that internal
detail never reaches a client (spec §22).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.errors import ErrorCode
from app.main import app

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
    "timezone_name": "Asia/Kolkata",
}

CHART_URL = "/api/v1/charts/vedic"


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _chart(client: TestClient, birth: dict, **extra) -> dict:
    response = client.post(CHART_URL, json={"birth": birth, **extra})
    assert response.status_code == 200, response.text
    return response.json()["chart"]


# --- Health ---------------------------------------------------------------


def test_health_reports_the_engine_it_will_use(client):
    """A misconfigured ephemeris should be visible here, not on first use."""
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["calculation_version"]
    assert "swisseph" in body["engine_id"]


# --- Chart calculation ----------------------------------------------------


def test_exact_birth_time_returns_a_complete_chart(client):
    chart = _chart(client, EXACT_BIRTH)

    assert chart["system"] == "vedic"
    assert chart["chart_type"] == "D1"
    assert len(chart["placements"]) == 9
    assert len(chart["bhavas"]) == 12
    assert chart["ascendant"]["rashi"] == "Vrischika"
    assert chart["metadata"]["unavailable"] == []


def test_response_matches_the_service_output(client, reference_birth, config):
    """The API must not reshape or round what the service calculated."""
    from app.services.astrology.vedic.d1 import calculate_d1_chart

    direct = calculate_d1_chart(reference_birth, config)
    over_http = _chart(client, EXACT_BIRTH)

    assert over_http == direct.model_dump(mode="json")


def test_metadata_travels_with_the_chart(client):
    """Reproducibility data has to survive serialisation (spec §10)."""
    metadata = _chart(client, EXACT_BIRTH)["metadata"]

    assert metadata["engine_id"]
    assert metadata["calculation_version"]
    assert metadata["config"]["ayanamsa"] == "lahiri"
    assert metadata["moment"]["timezone_name"] == "Asia/Kolkata"
    assert metadata["ayanamsa_degrees"] > 23.0


def test_timezone_is_resolved_when_omitted(client):
    birth = {k: v for k, v in EXACT_BIRTH.items() if k != "timezone_name"}

    chart = _chart(client, birth)

    assert chart["metadata"]["moment"]["timezone_name"] == "Asia/Kolkata"


def test_config_overrides_are_applied(client):
    """Advanced users may change the calculation (product spec §24)."""
    chart = _chart(
        client,
        EXACT_BIRTH,
        config={
            "ayanamsa": "lahiri",
            "house_system": "placidus",
            "ephemeris_source": "moshier",
            "node_type": "true",
            "calculation_version": "1.0.0",
        },
    )

    assert chart["metadata"]["config"]["node_type"] == "true"
    assert chart["metadata"]["config"]["house_system"] == "placidus"


# --- Unknown birth time is a valid request, not an error ------------------


def test_unknown_birth_time_succeeds(client):
    response = client.post(CHART_URL, json={"birth": UNKNOWN_TIME_BIRTH})

    assert response.status_code == 200


def test_unknown_birth_time_omits_time_dependent_factors(client):
    chart = _chart(client, UNKNOWN_TIME_BIRTH)

    assert chart["ascendant"] is None
    assert chart["bhavas"] == []
    assert chart["moon_nakshatra"] is None
    assert "ascendant" in chart["metadata"]["unavailable"]
    assert "bhavas" in chart["metadata"]["unavailable"]


def test_unknown_birth_time_still_returns_grahas(client):
    chart = _chart(client, UNKNOWN_TIME_BIRTH)

    assert len(chart["placements"]) == 9
    assert all(p["bhava"] is None for p in chart["placements"])


def test_unknown_birth_time_states_its_assumptions(client):
    """The invented noon anchor must be declared, not hidden (spec §8)."""
    assumptions = _chart(client, UNKNOWN_TIME_BIRTH)["metadata"]["moment"][
        "assumptions"
    ]

    assert assumptions
    assert any("unknown" in note.lower() for note in assumptions)


def test_unknown_birth_time_marks_the_moon_uncertain(client):
    chart = _chart(client, UNKNOWN_TIME_BIRTH)
    moon = next(p for p in chart["placements"] if p["graha"] == "Moon")

    assert moon["certainty"]["nakshatra_certain"] is False


# --- Error vocabulary -----------------------------------------------------


def test_missing_time_for_exact_confidence_is_rejected(client):
    birth = {k: v for k, v in EXACT_BIRTH.items() if k != "birth_time"}

    response = client.post(CHART_URL, json={"birth": birth})

    assert response.status_code == 422
    body = response.json()
    assert body["code"] == ErrorCode.INVALID_BIRTH_DATA
    assert body["field_errors"]


def test_out_of_range_latitude_is_rejected_with_the_field_named(client):
    """Field paths are dotted from the request root, e.g. `birth.latitude`.

    The full path matters: a frontend needs to know which input to highlight,
    and a bare "latitude" would be ambiguous once requests carry more than one
    object.
    """
    response = client.post(
        CHART_URL, json={"birth": {**EXACT_BIRTH, "latitude": 91.0}}
    )

    assert response.status_code == 422
    field_errors = response.json()["field_errors"]
    assert {error["field"] for error in field_errors} == {"birth.latitude"}
    assert "90" in field_errors[0]["message"]


def test_unknown_timezone_is_a_bad_request_not_a_crash(client):
    """Well-formed but unresolvable data gets 400 with a usable message."""
    response = client.post(
        CHART_URL,
        json={"birth": {**EXACT_BIRTH, "timezone_name": "Mars/Olympus_Mons"}},
    )

    assert response.status_code == 400
    body = response.json()
    assert body["code"] == ErrorCode.INVALID_BIRTH_DATA
    assert "Mars/Olympus_Mons" in body["message"]


def test_time_supplied_with_unknown_confidence_is_rejected(client):
    response = client.post(
        CHART_URL,
        json={"birth": {**UNKNOWN_TIME_BIRTH, "birth_time": "14:30:00"}},
    )

    assert response.status_code == 422
    assert response.json()["code"] == ErrorCode.INVALID_BIRTH_DATA


def test_malformed_date_is_rejected(client):
    response = client.post(
        CHART_URL, json={"birth": {**EXACT_BIRTH, "birth_date": "not-a-date"}}
    )

    assert response.status_code == 422


def test_empty_body_is_rejected(client):
    assert client.post(CHART_URL, json={}).status_code == 422


def test_calculation_failure_does_not_leak_internals(client, monkeypatch):
    """Engine messages can contain filesystem paths, so they must not be sent.

    Spec §22 forbids exposing infrastructure detail. The client gets a generic
    message plus a request id; the detail goes to the log.
    """
    from app.api.routes import charts
    from app.services.astrology.common.ephemeris import EphemerisError

    secret = "/secret/path/to/ephemeris/files"

    def boom(*args, **kwargs):
        raise EphemerisError(f"data files missing from {secret!r}")

    monkeypatch.setattr(charts, "calculate_d1_chart", boom)

    response = client.post(CHART_URL, json={"birth": EXACT_BIRTH})

    assert response.status_code == 500
    body = response.json()
    assert body["code"] == ErrorCode.CALCULATION_ERROR
    assert secret not in response.text
    assert body["request_id"]


def test_unexpected_failure_returns_no_stack_trace(monkeypatch):
    """An unanticipated exception must still produce a clean typed response.

    `raise_server_exceptions=False` makes the test client behave like a real
    server: Starlette returns our handler's response to the client and then
    re-raises internally so the error still reaches the logs. The default test
    client setting surfaces that re-raise instead of the response.
    """
    from app.api.routes import charts

    def boom(*args, **kwargs):
        raise RuntimeError("internal detail that must not ship")

    monkeypatch.setattr(charts, "calculate_d1_chart", boom)

    client = TestClient(app, raise_server_exceptions=False)
    response = client.post(CHART_URL, json={"birth": EXACT_BIRTH})

    assert response.status_code == 500
    assert response.json()["code"] == ErrorCode.INTERNAL_ERROR
    assert "internal detail" not in response.text
    assert "Traceback" not in response.text


# --- Request tracing ------------------------------------------------------


def test_every_response_carries_a_request_id(client):
    """Spec §32: request ids for tracing."""
    response = client.get("/health")

    assert response.headers["X-Request-Id"]


def test_supplied_request_id_is_preserved(client):
    """Lets a frontend correlate its own logs with the backend's."""
    response = client.get("/health", headers={"X-Request-Id": "abc123"})

    assert response.headers["X-Request-Id"] == "abc123"


def test_request_ids_are_unique_per_request(client):
    ids = {client.get("/health").headers["X-Request-Id"] for _ in range(5)}

    assert len(ids) == 5


# --- Documentation --------------------------------------------------------


def test_interactive_docs_are_served(client):
    """The /docs page is how this gets explored before a frontend exists."""
    assert client.get("/docs").status_code == 200


def test_openapi_describes_both_endpoints(client):
    paths = client.get("/openapi.json").json()["paths"]

    assert CHART_URL in paths
    assert "/health" in paths


def test_openapi_includes_worked_examples(client):
    """The examples are the usable documentation for a beginner."""
    schema = client.get("/openapi.json").json()
    request_schema = schema["components"]["schemas"]["VedicChartRequest"]

    assert "examples" in request_schema
    summaries = {example["summary"] for example in request_schema["examples"]}
    assert "Unknown birth time" in summaries
