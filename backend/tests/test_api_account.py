"""Account deletion cascades to everything the user owns."""

from __future__ import annotations

import pytest

DELETE_URL = "/api/v1/account/data"

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


def test_deletion_requires_authentication(client):
    response = client.delete(DELETE_URL)

    assert response.status_code == 401


def test_deletion_succeeds(client, auth_headers):
    response = client.delete(DELETE_URL, headers=auth_headers)

    assert response.status_code == 204


def test_deleted_account_cannot_use_its_old_token(client, auth_headers):
    client.delete(DELETE_URL, headers=auth_headers)

    response = client.get("/api/v1/profile", headers=auth_headers)
    assert response.status_code == 401


def test_deletion_removes_the_profile_and_journal_too(client, auth_headers):
    """The account holds real data, not just a bare user row, before deletion
    - otherwise this test would prove nothing about the cascade."""
    client.put("/api/v1/profile", json={"birth": EXACT_BIRTH}, headers=auth_headers)
    client.post(
        "/api/v1/journal",
        json={"title": "Entry", "body": "Something reflective."},
        headers=auth_headers,
    )

    assert client.delete(DELETE_URL, headers=auth_headers).status_code == 204

    # The email is free again - proof the User row itself is gone, not just
    # anonymised or soft-deleted.
    response = client.post("/api/v1/auth/register", json=CREDENTIALS)
    assert response.status_code == 201


def test_deletion_does_not_affect_other_accounts(client, auth_headers):
    other_credentials = {"email": "other@example.com", "password": "another password"}
    client.post("/api/v1/auth/register", json=other_credentials)
    other_token = client.post("/api/v1/auth/login", json=other_credentials).json()[
        "access_token"
    ]

    client.delete(DELETE_URL, headers=auth_headers)

    response = client.get(
        "/api/v1/journal", headers={"Authorization": f"Bearer {other_token}"}
    )
    assert response.status_code == 200
