"""OpenAPI documentation accuracy.

The /docs page is the only interface to this API until a frontend exists, so
what it claims has to match what the endpoints do. Swagger UI derives examples
from the schema when none are supplied, and for an enum field it picks the
first member for every response - documenting a 500 as INVALID_BIRTH_DATA.
These tests pin the explicit examples that prevent that.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.errors import ErrorCode
from app.main import app

CHART_URL = "/api/v1/charts/vedic"


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def chart_responses(client: TestClient) -> dict:
    schema = client.get("/openapi.json").json()
    return schema["paths"][CHART_URL]["post"]["responses"]


def _example(responses: dict, status: str) -> dict:
    return responses[status]["content"]["application/json"]["example"]


def test_every_error_status_is_documented(chart_responses):
    for status in ("400", "422", "500"):
        assert status in chart_responses, f"{status} is undocumented"


@pytest.mark.parametrize(
    ("status", "expected_code"),
    [
        ("400", ErrorCode.INVALID_BIRTH_DATA),
        ("422", ErrorCode.INVALID_BIRTH_DATA),
        ("500", ErrorCode.CALCULATION_ERROR),
    ],
)
def test_documented_code_matches_the_real_one(
    chart_responses, status, expected_code
):
    """Guards the exact bug this file exists for: a 500 documented as a 400."""
    assert _example(chart_responses, status)["code"] == expected_code.value


def test_documented_examples_are_not_type_placeholders(chart_responses):
    """`"message": "string"` is Swagger's filler, not a usable example."""
    for status in ("400", "422", "500"):
        example = _example(chart_responses, status)

        assert example["message"] != "string"
        assert example["request_id"] != "string"
        assert len(example["message"]) > 20


def test_validation_example_shows_a_real_field_path(chart_responses):
    field_errors = _example(chart_responses, "422")["field_errors"]

    assert field_errors
    assert field_errors[0]["field"] == "birth.latitude"


def test_documented_400_matches_a_live_response(client, chart_responses):
    """The documented example must agree with the server's actual output."""
    documented = _example(chart_responses, "400")

    live = client.post(
        CHART_URL,
        json={
            "birth": {
                "birth_date": "1990-08-15",
                "birth_time": "14:30:00",
                "time_confidence": "EXACT",
                "latitude": 18.9756,
                "longitude": 72.8258,
                "timezone_name": "Mars/Olympus_Mons",
            }
        },
    ).json()

    assert live["code"] == documented["code"]
    assert live["message"] == documented["message"]


def test_documented_422_matches_a_live_response(client, chart_responses):
    documented = _example(chart_responses, "422")

    live = client.post(
        CHART_URL,
        json={
            "birth": {
                "birth_date": "1990-08-15",
                "birth_time": "14:30:00",
                "time_confidence": "EXACT",
                "latitude": 91.0,
                "longitude": 72.8258,
            }
        },
    ).json()

    assert live["code"] == documented["code"]
    assert live["message"] == documented["message"]
    assert live["field_errors"][0]["field"] == (
        documented["field_errors"][0]["field"]
    )


def test_success_response_is_documented(chart_responses):
    assert "200" in chart_responses
