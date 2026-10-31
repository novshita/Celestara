"""Planet exploration."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.services.astrology.common.constants import NAVAGRAHA

URL = "/api/v1/explore/planet"
BIRTH = {
    "birth_date": "1990-08-15",
    "birth_time": "14:30:00",
    "time_confidence": "EXACT",
    "latitude": 18.9756,
    "longitude": 72.8258,
    "timezone_name": "Asia/Kolkata",
}
UNKNOWN_TIME = {
    "birth_date": "1990-08-15",
    "time_confidence": "UNKNOWN",
    "latitude": 18.9756,
    "longitude": 72.8258,
}
WESTERN_BODIES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"]


def explore(client, body, system="vedic", birth=BIRTH, **extra):
    return client.post(URL, json={"birth": birth, "system": system, "body": body, **extra})


def test_a_vedic_planet_has_placement_transit_and_description(client):
    response = explore(client, "Saturn")

    assert response.status_code == 200
    body = response.json()
    assert body["system"] == "vedic" and body["body"] == "Saturn"
    assert body["placement"]["graha"] == "Saturn"
    assert body["placement"]["rashi"] and body["placement"]["nakshatra"]["name"]
    assert body["placement"]["bhava"] is not None
    assert body["transit"]["graha"] == "Saturn"
    assert body["about"]["id"] == "vedic-graha-saturn"
    assert body["about"]["text"]
    assert body["position"] is None and body["aspects"] == []


def test_a_western_planet_has_position_aspects_and_description(client):
    body = explore(client, "Mars", system="western").json()

    assert body["position"]["body"] == "Mars"
    assert body["position"]["sign"] and body["position"]["house"] is not None
    assert body["about"]["id"] == "western-planet-mars"
    assert body["placement"] is None and body["transit"] is None
    assert all("Mars" in (a["first"], a["second"]) for a in body["aspects"])


def test_the_name_is_case_insensitive(client):
    assert explore(client, "  sAtUrN ").json()["body"] == "Saturn"


@pytest.mark.parametrize("graha", NAVAGRAHA)
def test_every_graha_can_be_explored(client, graha):
    body = explore(client, graha).json()

    assert body["placement"]["graha"] == graha
    assert body["about"] is not None


@pytest.mark.parametrize("planet", WESTERN_BODIES)
def test_every_western_planet_can_be_explored(client, planet):
    body = explore(client, planet, system="western").json()

    assert body["position"]["body"] == planet
    assert body["about"] is not None


def test_an_unknown_body_is_a_404(client):
    response = explore(client, "Vulcan")

    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"


def test_an_outer_planet_is_unknown_when_the_configuration_leaves_them_out(client):
    response = explore(client, "Pluto", system="western", config={"include_outer_planets": False})

    assert response.status_code == 404


def test_rahu_is_not_a_western_body_and_uranus_is_not_a_graha(client):
    assert explore(client, "Rahu", system="western").status_code == 404
    assert explore(client, "Uranus", system="vedic").status_code == 404


def test_an_unknown_birth_time_leaves_the_bhava_out(client):
    vedic = explore(client, "Saturn", birth=UNKNOWN_TIME).json()
    western = explore(client, "Saturn", system="western", birth=UNKNOWN_TIME).json()

    assert vedic["placement"]["bhava"] is None
    assert western["position"]["house"] is None


def test_it_is_deterministic_apart_from_the_current_sky(client):
    first = explore(client, "Jupiter", system="western").json()
    second = explore(client, "Jupiter", system="western").json()

    assert first == second


def test_it_needs_no_account_and_never_calls_a_model(client):
    with patch("app.services.ai.service.anthropic.Anthropic") as anthropic:
        assert explore(client, "Venus").status_code == 200
        assert explore(client, "Venus", system="western").status_code == 200

    anthropic.assert_not_called()


def test_bad_input_is_a_422(client):
    assert client.post(URL, json={"birth": BIRTH, "body": ""}).status_code == 422
    assert client.post(URL, json={"birth": BIRTH, "body": "Saturn", "system": "chinese"}).status_code == 422
    assert client.post(URL, json={"birth": {"birth_date": "nope"}, "body": "Saturn"}).status_code == 422


def test_it_is_documented(client):
    paths = client.get("/openapi.json").json()["paths"]

    assert "/api/v1/explore/planet" in paths
    assert "404" in paths["/api/v1/explore/planet"]["post"]["responses"]
