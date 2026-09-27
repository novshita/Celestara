"""The one saved birth profile per user."""

from __future__ import annotations

import pytest

PROFILE_URL = "/api/v1/profile"

CREDENTIALS = {"email": "astronaut@example.com", "password": "correct horse battery"}

EXACT_BIRTH = {
    "birth_date": "1990-08-15",
    "birth_time": "14:30:00",
    "time_confidence": "EXACT",
    "latitude": 18.9756,
    "longitude": 72.8258,
    "timezone_name": "Asia/Kolkata",
}


@pytest.fixture
def auth_headers(client) -> dict:
    client.post("/api/v1/auth/register", json=CREDENTIALS)
    token = client.post("/api/v1/auth/login", json=CREDENTIALS).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_no_profile_yet_is_a_404(client, auth_headers):
    response = client.get(PROFILE_URL, headers=auth_headers)

    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"


def test_saving_a_profile_returns_it(client, auth_headers):
    response = client.put(
        PROFILE_URL, json={"birth": EXACT_BIRTH}, headers=auth_headers
    )

    assert response.status_code == 200
    body = response.json()
    assert body["birth"]["birth_date"] == "1990-08-15"
    assert body["birth"]["timezone_name"] == "Asia/Kolkata"
    assert "id" in body and "created_at" in body


def test_saved_profile_can_be_read_back(client, auth_headers):
    client.put(PROFILE_URL, json={"birth": EXACT_BIRTH}, headers=auth_headers)
    response = client.get(PROFILE_URL, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["birth"]["latitude"] == 18.9756


def test_saving_again_replaces_rather_than_duplicates(client, auth_headers):
    client.put(PROFILE_URL, json={"birth": EXACT_BIRTH}, headers=auth_headers)
    updated = {**EXACT_BIRTH, "birth_date": "1985-03-21"}
    client.put(PROFILE_URL, json={"birth": updated}, headers=auth_headers)

    response = client.get(PROFILE_URL, headers=auth_headers)
    assert response.json()["birth"]["birth_date"] == "1985-03-21"


def test_profiles_are_isolated_between_users(client, auth_headers):
    client.put(PROFILE_URL, json={"birth": EXACT_BIRTH}, headers=auth_headers)

    other_credentials = {"email": "other@example.com", "password": "another password"}
    client.post("/api/v1/auth/register", json=other_credentials)
    other_token = client.post("/api/v1/auth/login", json=other_credentials).json()[
        "access_token"
    ]

    response = client.get(
        PROFILE_URL, headers={"Authorization": f"Bearer {other_token}"}
    )
    assert response.status_code == 404


def test_unauthenticated_request_is_rejected(client):
    response = client.get(PROFILE_URL)

    assert response.status_code == 401


def test_invalid_birth_data_is_rejected(client, auth_headers):
    response = client.put(
        PROFILE_URL,
        json={"birth": {**EXACT_BIRTH, "latitude": 91.0}},
        headers=auth_headers,
    )

    assert response.status_code == 422
