"""Dasha timeline endpoint.

The contract that matters most here is the refusal: unlike the chart endpoint,
this one cannot serve a request with no birth time, and it has to say so in a
way the frontend can distinguish from bad input.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.api.errors import ErrorCode
from app.main import app

URL = "/api/v1/dashas/vimshottari"

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


def _timeline(client: TestClient, birth: dict = None, **extra) -> dict:
    response = client.post(URL, json={"birth": birth or EXACT_BIRTH, **extra})
    assert response.status_code == 200, response.text
    return response.json()


# --- Success --------------------------------------------------------------


def test_timeline_is_returned(client):
    body = _timeline(client)

    assert body["timeline"]["system"] == "vimshottari"
    assert body["timeline"]["starting_lord"] == "Moon"
    assert len(body["timeline"]["periods"]) == 9


def test_periods_are_nested_two_levels_by_default(client):
    periods = _timeline(client)["timeline"]["periods"]

    assert all(p["level"] == "maha" for p in periods)
    assert all(s["level"] == "antar" for s in periods[-1]["sub_periods"])


def test_active_period_lineage_is_reported(client):
    """Saves the caller from searching the timeline themselves."""
    body = _timeline(client, as_of="2026-09-22T00:00:00Z")

    lineage = body["active_now"]
    assert [p["level"] for p in lineage] == ["maha", "antar"]
    assert body["as_of"].startswith("2026-09-22")


def test_active_period_defaults_to_now(client):
    body = _timeline(client)

    assert body["as_of"]
    assert body["active_now"], "a 1990 birth should have a current period"


def test_naive_as_of_is_treated_as_utc(client):
    body = _timeline(client, as_of="2026-09-22T00:00:00")

    assert body["active_now"]


def test_as_of_outside_the_cycle_returns_no_active_period(client):
    """Before birth: valid question, empty answer."""
    body = _timeline(client, as_of="1950-01-01T00:00:00Z")

    assert body["active_now"] == []


def test_timeline_records_its_configuration(client):
    """Reproducibility (spec §10) - year length is part of the result."""
    timeline = _timeline(client)["timeline"]

    assert timeline["year_length"] == "julian"
    assert timeline["year_days"] == 365.25
    assert timeline["config"]["dasha_year_length"] == "julian"
    assert timeline["moment"]["timezone_name"] == "Asia/Kolkata"


# --- Configuration --------------------------------------------------------


def test_year_length_override_changes_the_timeline(client):
    julian = _timeline(client)["timeline"]
    savana = _timeline(client, config={"dasha_year_length": "savana"})["timeline"]

    assert savana["year_days"] == 360.0
    assert savana["periods"][-1]["end"] < julian["periods"][-1]["end"]


def test_level_depth_override_is_applied(client):
    timeline = _timeline(client, config={"dasha_levels": 3})["timeline"]

    deepest = timeline["periods"][-1]["sub_periods"][0]["sub_periods"][0]
    assert deepest["level"] == "pratyantar"


def test_single_level_omits_sub_periods(client):
    timeline = _timeline(client, config={"dasha_levels": 1})["timeline"]

    assert all(p["sub_periods"] == [] for p in timeline["periods"])


def test_excessive_level_depth_is_rejected(client):
    """Five levels would be ~59000 periods; the cap is enforced by config."""
    response = client.post(
        URL, json={"birth": EXACT_BIRTH, "config": {"dasha_levels": 5}}
    )

    assert response.status_code == 422
    assert response.json()["code"] == ErrorCode.INVALID_BIRTH_DATA


# --- The refusal ----------------------------------------------------------


def test_unknown_birth_time_is_refused_with_its_own_code(client):
    """Must be distinguishable from bad input: the request was fine."""
    response = client.post(URL, json={"birth": UNKNOWN_TIME_BIRTH})

    assert response.status_code == 422
    assert response.json()["code"] == ErrorCode.UNKNOWN_BIRTH_TIME


def test_refusal_explains_why_rather_than_just_refusing(client):
    """The UI needs to tell the user what would make this work."""
    message = client.post(URL, json={"birth": UNKNOWN_TIME_BIRTH}).json()["message"]

    assert "nakshatra" in message.lower()
    assert "birth time" in message.lower()


def test_refusal_is_not_conflated_with_invalid_data(client):
    """A genuinely invalid request gets a different code."""
    bad = client.post(
        URL, json={"birth": {**EXACT_BIRTH, "latitude": 91.0}}
    ).json()
    unknown = client.post(URL, json={"birth": UNKNOWN_TIME_BIRTH}).json()

    assert bad["code"] == ErrorCode.INVALID_BIRTH_DATA
    assert unknown["code"] == ErrorCode.UNKNOWN_BIRTH_TIME


def test_chart_endpoint_still_accepts_unknown_birth_time(client):
    """The two endpoints differ on purpose.

    A chart without a birth time is still useful - grahas keep their signs.
    A Dasha timeline without one is not, since the lord itself is unknown.
    """
    chart = client.post("/api/v1/charts/vedic", json={"birth": UNKNOWN_TIME_BIRTH})
    dasha = client.post(URL, json={"birth": UNKNOWN_TIME_BIRTH})

    assert chart.status_code == 200
    assert dasha.status_code == 422


# --- Uncertainty ----------------------------------------------------------


def test_exact_time_reports_no_uncertainty(client):
    assert _timeline(client)["timeline"]["uncertainty_days"] == 0.0


def test_estimated_time_reports_boundary_uncertainty(client):
    """An hour of doubt is worth months of Dasha timing, so it is surfaced."""
    birth = {**EXACT_BIRTH, "time_confidence": "ESTIMATED"}

    timeline = _timeline(client, birth)["timeline"]

    assert timeline["uncertainty_days"] > 100.0


# --- Documentation --------------------------------------------------------


def test_endpoint_is_documented(client):
    paths = client.get("/openapi.json").json()["paths"]

    assert URL in paths


def test_unknown_birth_time_response_is_documented(client):
    """The 422 example must show UNKNOWN_BIRTH_TIME, not the first enum member."""
    schema = client.get("/openapi.json").json()
    responses = schema["paths"][URL]["post"]["responses"]

    example = responses["422"]["content"]["application/json"]["example"]
    assert example["code"] == ErrorCode.UNKNOWN_BIRTH_TIME
