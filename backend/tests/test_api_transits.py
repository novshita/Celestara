"""Transit endpoints.

Two endpoints with deliberately different shapes: a GET for the
user-independent snapshot, and a POST for the natal-relative report. The GET
being a real GET is the point - it carries no personal data, so it is
cacheable by anything between the client and us.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.astrology.common.constants import NAVAGRAHA
from app.services.astrology.transit.service import clear_snapshot_cache

SNAPSHOT_URL = "/api/v1/transits"
REPORT_URL = "/api/v1/transits/vedic"

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

AT = "2026-09-22T12:00:00Z"


@pytest.fixture(autouse=True)
def _clean_cache():
    clear_snapshot_cache()
    yield
    clear_snapshot_cache()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# --- Snapshot endpoint ---------------------------------------------------


def test_snapshot_needs_no_parameters(client):
    """Defaults to now, so it works as a bare GET."""
    response = client.get(SNAPSHOT_URL)

    assert response.status_code == 200
    assert len(response.json()["snapshot"]["positions"]) == 9


def test_snapshot_accepts_a_moment(client):
    snapshot = client.get(SNAPSHOT_URL, params={"at": AT}).json()["snapshot"]

    assert snapshot["moment"].startswith("2026-09-22T12:00:00")
    assert tuple(p["graha"] for p in snapshot["positions"]) == NAVAGRAHA


def test_snapshot_reports_the_quantised_moment(client):
    """Timestamp and positions must describe the same instant."""
    snapshot = client.get(
        SNAPSHOT_URL, params={"at": "2026-09-22T12:00:45Z"}
    ).json()["snapshot"]

    assert snapshot["moment"].startswith("2026-09-22T12:00:00")
    assert snapshot["granularity_seconds"] == 60


def test_snapshot_is_identical_for_every_caller(client):
    """The property that makes it cacheable."""
    first = client.get(SNAPSHOT_URL, params={"at": AT}).json()
    second = client.get(SNAPSHOT_URL, params={"at": AT}).json()

    assert first == second


def test_snapshot_response_contains_no_birth_data(client):
    """Nothing personal may appear in a response shared across users."""
    body = client.get(SNAPSHOT_URL, params={"at": AT}).text

    for personal in ("18.9756", "72.8258", "Asia/Kolkata", "1990-08-15"):
        assert personal not in body


def test_snapshot_records_what_produced_it(client):
    snapshot = client.get(SNAPSHOT_URL, params={"at": AT}).json()["snapshot"]

    assert "swisseph" in snapshot["engine_id"]
    assert snapshot["config"]["ayanamsa"] == "lahiri"


def test_malformed_moment_is_rejected(client):
    assert client.get(SNAPSHOT_URL, params={"at": "not-a-date"}).status_code == 422


# --- Report endpoint -----------------------------------------------------


def _report(client: TestClient, birth: dict = None, **extra) -> dict:
    response = client.post(
        REPORT_URL, json={"birth": birth or EXACT_BIRTH, "at": AT, **extra}
    )
    assert response.status_code == 200, response.text
    return response.json()["report"]


def test_report_relates_transits_to_the_chart(client):
    report = _report(client)

    assert report["natal_ascendant_rashi"] == "Vrischika"
    assert report["natal_moon_rashi"] == "Vrishabha"
    assert len(report["transits"]) == 9


def test_report_gives_both_reference_points(client):
    """Ascendant and Chandra Lagna are both reported."""
    for transit in _report(client)["transits"]:
        assert 1 <= transit["bhava_from_ascendant"] <= 12
        assert 1 <= transit["bhava_from_moon"] <= 12


def test_report_includes_the_snapshot_it_used(client):
    report = _report(client)

    assert report["snapshot"]["moment"].startswith("2026-09-22T12:00:00")
    assert len(report["snapshot"]["positions"]) == 9


def test_report_flags_a_graha_back_in_its_natal_rashi(client):
    transits = _report(client)["transits"]

    returning = [t for t in transits if t["in_natal_rashi"]]
    for transit in returning:
        assert transit["separation_from_natal"] < 30.0


def test_report_defaults_to_now(client):
    response = client.post(REPORT_URL, json={"birth": EXACT_BIRTH})

    assert response.status_code == 200
    assert response.json()["report"]["snapshot"]["moment"]


def test_naive_moment_is_treated_as_utc(client):
    report = _report(client, at="2026-09-22T12:00:00")

    assert report["snapshot"]["moment"].startswith("2026-09-22T12:00:00")


# --- Unknown birth time is accepted here --------------------------------


def test_unknown_birth_time_is_accepted(client):
    """Differs from the Dasha endpoint on purpose.

    Transiting positions depend on the present moment, not the birth, so they
    remain exact; only the natal comparison degrades.
    """
    response = client.post(
        REPORT_URL, json={"birth": UNKNOWN_TIME_BIRTH, "at": AT}
    )

    assert response.status_code == 200


def test_unknown_birth_time_withholds_the_ascendant_reference(client):
    report = _report(client, UNKNOWN_TIME_BIRTH)

    assert report["natal_ascendant_rashi"] is None
    assert "bhava_from_ascendant" in report["unavailable"]
    assert all(t["bhava_from_ascendant"] is None for t in report["transits"])


def test_unknown_birth_time_keeps_transit_positions_exact(client):
    """The snapshot must be identical to the anonymous one."""
    anonymous = client.get(SNAPSHOT_URL, params={"at": AT}).json()["snapshot"]
    personal = _report(client, UNKNOWN_TIME_BIRTH)["snapshot"]

    assert [p["longitude"] for p in personal["positions"]] == [
        p["longitude"] for p in anonymous["positions"]
    ]


def test_dasha_refuses_where_transits_do_not(client):
    """The endpoints diverge according to what actually needs a birth time."""
    transits = client.post(REPORT_URL, json={"birth": UNKNOWN_TIME_BIRTH})
    dasha = client.post(
        "/api/v1/dashas/vimshottari", json={"birth": UNKNOWN_TIME_BIRTH}
    )

    assert transits.status_code == 200
    assert dasha.status_code == 422


# --- Errors --------------------------------------------------------------


def test_invalid_birth_data_is_rejected(client):
    response = client.post(
        REPORT_URL, json={"birth": {**EXACT_BIRTH, "latitude": 91.0}}
    )

    assert response.status_code == 422
    assert response.json()["field_errors"][0]["field"] == "birth.latitude"


def test_unresolvable_timezone_is_a_bad_request(client):
    response = client.post(
        REPORT_URL,
        json={"birth": {**EXACT_BIRTH, "timezone_name": "Mars/Olympus"}},
    )

    assert response.status_code == 400


# --- Documentation ------------------------------------------------------


def test_both_endpoints_are_documented(client):
    paths = client.get("/openapi.json").json()["paths"]

    assert SNAPSHOT_URL in paths
    assert REPORT_URL in paths
    assert "get" in paths[SNAPSHOT_URL]
    assert "post" in paths[REPORT_URL]
