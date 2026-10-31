"""Saved preferences, and the optional-authentication dependency they share
with the AI endpoints."""

from __future__ import annotations

import pytest

URL = "/api/v1/preferences"


@pytest.fixture
def headers(make_user):
    return make_user()


def test_preferences_require_an_account(client):
    assert client.get(URL).status_code == 401
    assert client.put(URL, json={"explanation_depth": "technical"}).status_code == 401


def test_defaults_before_anything_is_saved(client, headers):
    body = client.get(URL, headers=headers).json()

    assert body["explanation_depth"] == "beginner"
    assert body["calculation_config"] is None


def test_reading_defaults_does_not_create_a_row(client, headers, session_factory):
    from app.db.models import UserPreferences

    client.get(URL, headers=headers)

    with session_factory() as db:
        assert db.query(UserPreferences).count() == 0


def test_saving_and_reading_back(client, headers):
    saved = client.put(URL, json={"explanation_depth": "technical"}, headers=headers)

    assert saved.status_code == 200
    assert saved.json()["explanation_depth"] == "technical"
    assert client.get(URL, headers=headers).json()["explanation_depth"] == "technical"


def test_saving_twice_replaces_it(client, headers, session_factory):
    from app.db.models import UserPreferences

    client.put(URL, json={"explanation_depth": "technical"}, headers=headers)
    client.put(URL, json={"explanation_depth": "beginner"}, headers=headers)

    assert client.get(URL, headers=headers).json()["explanation_depth"] == "beginner"
    with session_factory() as db:
        assert db.query(UserPreferences).count() == 1


def test_a_calculation_config_round_trips_and_can_be_cleared(client, headers):
    config = {"aspect_orb_degrees": 5.0, "node_type": "true"}

    saved = client.put(
        URL, json={"explanation_depth": "beginner", "calculation_config": config}, headers=headers
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["calculation_config"]["aspect_orb_degrees"] == 5.0
    assert saved.json()["calculation_config"]["node_type"] == "true"

    cleared = client.put(URL, json={"explanation_depth": "beginner"}, headers=headers)
    assert cleared.json()["calculation_config"] is None


@pytest.mark.parametrize(
    "body",
    [
        {"explanation_depth": "expert"},
        {"calculation_config": {"node_type": "nope"}},
        {"calculation_config": {"ephemeris_path": "/etc"}},
    ],
)
def test_invalid_values_are_rejected(client, headers, body):
    assert client.put(URL, json=body, headers=headers).status_code == 422


def test_preferences_are_per_user(client, make_user):
    alice, bob = make_user("alice@example.com"), make_user("bob@example.com")

    client.put(URL, json={"explanation_depth": "technical"}, headers=alice)

    assert client.get(URL, headers=bob).json()["explanation_depth"] == "beginner"


def test_preferences_go_with_the_account(client, headers, session_factory):
    from app.db.models import UserPreferences

    client.put(URL, json={"explanation_depth": "technical"}, headers=headers)
    assert client.delete("/api/v1/account/data", headers=headers).status_code == 204

    with session_factory() as db:
        assert db.query(UserPreferences).count() == 0
