"""Western chart endpoint."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app

URL = "/api/v1/charts/western"
VEDIC_URL = "/api/v1/charts/vedic"

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


def _chart(client: TestClient, birth: dict = None, **extra) -> dict:
    response = client.post(URL, json={"birth": birth or EXACT_BIRTH, **extra})
    assert response.status_code == 200, response.text
    return response.json()["chart"]


# --- Success --------------------------------------------------------------


def test_chart_is_returned(client):
    chart = _chart(client)

    assert chart["system"] == "western"
    assert chart["zodiac"] == "tropical"
    assert len(chart["positions"]) == 10
    assert len(chart["houses"]) == 12


def test_angles_are_reported(client):
    angles = _chart(client)["angles"]

    assert angles["ascendant_sign"] == "Sagittarius"
    assert angles["ascendant_ruler"] == "Jupiter"
    assert angles["midheaven_sign"]


def test_aspects_are_reported_tightest_first(client):
    aspects = _chart(client)["aspects"]

    assert aspects
    orbs = [abs(a["orb"]) for a in aspects]
    assert orbs == sorted(orbs)


def test_aspects_carry_their_direction_and_tone(client):
    for aspect in _chart(client)["aspects"]:
        assert isinstance(aspect["applying"], bool)
        assert aspect["aspect"]
        if aspect["aspect"] == "Conjunction":
            assert aspect["harmonious"] is None
        else:
            assert isinstance(aspect["harmonious"], bool)


def test_metadata_records_the_house_system_and_bodies(client):
    metadata = _chart(client)["metadata"]

    assert metadata["house_system"] == "placidus"
    assert len(metadata["bodies_included"]) == 10
    assert "swisseph" in metadata["engine_id"]


# --- The two systems are genuinely separate ------------------------------


def test_the_two_endpoints_disagree_about_the_sun_sign(client):
    """What Compare mode will exist to explain."""
    western = _chart(client)
    vedic = client.post(VEDIC_URL, json={"birth": EXACT_BIRTH}).json()["chart"]

    western_sun = next(p for p in western["positions"] if p["body"] == "Sun")
    vedic_sun = next(p for p in vedic["placements"] if p["graha"] == "Sun")

    assert western_sun["sign"] == "Leo"
    assert vedic_sun["rashi"] == "Karka"


def test_longitudes_differ_by_the_ayanamsa(client):
    """Guards against the two pipelines reading the same frame."""
    western = _chart(client)
    vedic = client.post(VEDIC_URL, json={"birth": EXACT_BIRTH}).json()["chart"]
    ayanamsa = vedic["metadata"]["ayanamsa_degrees"]

    for body in ("Sun", "Moon", "Mars", "Jupiter", "Saturn"):
        tropical = next(
            p["longitude"] for p in western["positions"] if p["body"] == body
        )
        sidereal = next(
            p["longitude"] for p in vedic["placements"] if p["graha"] == body
        )
        assert (tropical - sidereal) % 360.0 == pytest.approx(ayanamsa, abs=1e-6)


def test_western_uses_placidus_while_vedic_uses_whole_sign(client):
    """Separate house settings, so neither tradition is forced to be wrong."""
    western = _chart(client)
    vedic = client.post(VEDIC_URL, json={"birth": EXACT_BIRTH}).json()["chart"]

    assert any(h["cusp_longitude"] % 30.0 > 0.001 for h in western["houses"])
    assert all(b["cusp_longitude"] % 30.0 < 0.001 for b in vedic["bhavas"])


def test_western_includes_bodies_vedic_does_not(client):
    western_bodies = {p["body"] for p in _chart(client)["positions"]}
    vedic_grahas = {
        p["graha"]
        for p in client.post(VEDIC_URL, json={"birth": EXACT_BIRTH})
        .json()["chart"]["placements"]
    }

    assert {"Uranus", "Neptune", "Pluto"} <= western_bodies
    assert {"Rahu", "Ketu"} <= vedic_grahas
    assert "Rahu" not in western_bodies


# --- Configuration -------------------------------------------------------


def test_house_system_override_is_applied(client):
    chart = _chart(client, config={"western_house_system": "equal"})

    sizes = {round(h["size_degrees"], 6) for h in chart["houses"]}
    assert sizes == {30.0}
    assert chart["metadata"]["house_system"] == "equal"


def test_outer_planets_can_be_excluded(client):
    chart = _chart(client, config={"include_outer_planets": False})

    bodies = {p["body"] for p in chart["positions"]}
    assert not {"Uranus", "Neptune", "Pluto"} & bodies
    assert len(bodies) == 7


def test_orb_override_changes_the_aspect_count(client):
    wide = _chart(client, config={"aspect_orb_degrees": 10.0})
    tight = _chart(client, config={"aspect_orb_degrees": 2.0})

    assert len(wide["aspects"]) > len(tight["aspects"])


def test_excessive_orb_is_rejected(client):
    response = client.post(
        URL, json={"birth": EXACT_BIRTH, "config": {"aspect_orb_degrees": 90.0}}
    )

    assert response.status_code == 422


# --- Unknown birth time --------------------------------------------------


def test_unknown_birth_time_is_accepted(client):
    response = client.post(URL, json={"birth": UNKNOWN_TIME_BIRTH})

    assert response.status_code == 200


def test_unknown_birth_time_withholds_angles_and_houses(client):
    chart = _chart(client, UNKNOWN_TIME_BIRTH)

    assert chart["angles"] is None
    assert chart["houses"] == []
    assert "angles" in chart["metadata"]["unavailable"]
    assert all(p["house"] is None for p in chart["positions"])


def test_unknown_birth_time_still_returns_signs_and_aspects(client):
    chart = _chart(client, UNKNOWN_TIME_BIRTH)

    assert len(chart["positions"]) == 10
    assert all(p["sign"] for p in chart["positions"])
    assert chart["aspects"]


# --- Errors and docs -----------------------------------------------------


def test_invalid_birth_data_is_rejected(client):
    response = client.post(
        URL, json={"birth": {**EXACT_BIRTH, "latitude": 91.0}}
    )

    assert response.status_code == 422
    assert response.json()["field_errors"][0]["field"] == "birth.latitude"


def test_endpoint_is_documented_with_examples(client):
    schema = client.get("/openapi.json").json()

    assert URL in schema["paths"]
    request_schema = schema["components"]["schemas"]["WesternChartRequest"]
    assert "examples" in request_schema
