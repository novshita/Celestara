"""Compare endpoint."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

URL = "/api/v1/charts/compare"

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


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _comparison(client: TestClient, birth: dict = None, **extra) -> dict:
    response = client.post(URL, json={"birth": birth or EXACT_BIRTH, **extra})
    assert response.status_code == 200, response.text
    return response.json()["comparison"]


# --- Success --------------------------------------------------------------


def test_comparison_carries_both_full_charts(client):
    comparison = _comparison(client)

    assert comparison["vedic"]["system"] == "vedic"
    assert comparison["western"]["system"] == "western"


def test_shared_bodies_are_the_seven_classical_ones(client):
    comparison = _comparison(client)

    bodies = {b["body"] for b in comparison["shared_bodies"]}
    assert bodies == {
        "Sun",
        "Moon",
        "Mercury",
        "Venus",
        "Mars",
        "Jupiter",
        "Saturn",
    }


def test_shared_bodies_carry_both_signs_and_the_gap_between_them(client):
    comparison = _comparison(client)
    sun = next(b for b in comparison["shared_bodies"] if b["body"] == "Sun")

    assert sun["vedic_rashi"] == "Karka"
    assert sun["western_sign"] == "Leo"
    assert sun["signs_apart"] == 1


def test_ayanamsa_explains_every_shared_body_gap(client):
    """The one number that accounts for the whole comparison."""
    comparison = _comparison(client)
    ayanamsa = comparison["metadata"]["ayanamsa_degrees"]

    for body in comparison["shared_bodies"]:
        implied = body["western_degrees_in_sign"] - body["vedic_degrees_in_rashi"]
        implied += body["signs_apart"] * 30.0
        assert implied == pytest.approx(ayanamsa, abs=1e-6)


def test_ascendant_is_compared_when_birth_time_is_known(client):
    comparison = _comparison(client)

    assert comparison["ascendant"]["vedic_rashi"]
    assert comparison["ascendant"]["western_sign"]
    assert "ascendant" not in comparison["metadata"]["unavailable"]


def test_neither_system_is_declared_more_accurate(client):
    """No such field exists to assert against; this documents the omission."""
    comparison = _comparison(client)

    assert "accuracy" not in comparison["metadata"]
    assert "winner" not in comparison


# --- Unknown birth time --------------------------------------------------


def test_unknown_birth_time_is_accepted(client):
    response = client.post(URL, json={"birth": UNKNOWN_TIME_BIRTH})

    assert response.status_code == 200


def test_unknown_birth_time_withholds_only_the_ascendant(client):
    comparison = _comparison(client, UNKNOWN_TIME_BIRTH)

    assert comparison["ascendant"] is None
    assert comparison["metadata"]["unavailable"] == ["ascendant"]
    assert len(comparison["shared_bodies"]) == 7


# --- Configuration ---------------------------------------------------------


def test_config_override_reaches_both_pipelines(client):
    comparison = _comparison(
        client,
        config={"western_house_system": "equal", "include_outer_planets": False},
    )

    assert comparison["western"]["metadata"]["house_system"] == "equal"
    assert len(comparison["western"]["positions"]) == 7
    assert comparison["vedic"]["metadata"]["config"]["include_outer_planets"] is False


# --- Errors and docs -------------------------------------------------------


def test_invalid_birth_data_is_rejected(client):
    response = client.post(URL, json={"birth": {**EXACT_BIRTH, "latitude": 91.0}})

    assert response.status_code == 422
    assert response.json()["field_errors"][0]["field"] == "birth.latitude"


def test_endpoint_is_documented_with_examples(client):
    schema = client.get("/openapi.json").json()

    assert URL in schema["paths"]
    request_schema = schema["components"]["schemas"]["CompareChartRequest"]
    assert "examples" in request_schema
