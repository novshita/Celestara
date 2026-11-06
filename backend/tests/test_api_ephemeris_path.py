"""`ephemeris_path` is a server setting: no endpoint may accept it from a client.

Preferences already rejected it; the chart, Dasha, transit, AI, reading and
explore endpoints took a `config` straight from the request body and did not.
"""

from __future__ import annotations

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
BAD_CONFIG = {"ephemeris_source": "swiss", "ephemeris_path": "/etc"}


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.mark.parametrize(
    "url, body",
    [
        ("/api/v1/charts/vedic", {"birth": BIRTH}),
        ("/api/v1/charts/western", {"birth": BIRTH}),
        ("/api/v1/charts/compare", {"birth": BIRTH}),
        ("/api/v1/dashas/vimshottari", {"birth": BIRTH}),
        ("/api/v1/transits/vedic", {"birth": BIRTH}),
        ("/api/v1/ai/chat", {"birth": BIRTH, "question": "hello"}),
        ("/api/v1/readings/daily", {"birth": BIRTH}),
        ("/api/v1/readings/topic/career", {"birth": BIRTH}),
        ("/api/v1/explore/planet", {"birth": BIRTH, "planet": "saturn"}),
    ],
)
def test_client_cannot_set_ephemeris_path(client, url, body):
    response = client.post(url, json={**body, "config": BAD_CONFIG})

    assert response.status_code == 422, (url, response.text)
    assert "ephemeris_path" in response.text
    assert "/etc" not in response.json().get("message", "")


def test_config_without_a_path_is_still_accepted(client):
    response = client.post(
        "/api/v1/charts/vedic",
        json={"birth": BIRTH, "config": {"aspect_orb_degrees": 5.0}},
    )

    assert response.status_code == 200
