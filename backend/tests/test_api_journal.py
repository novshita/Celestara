"""Journal CRUD."""

from __future__ import annotations

import pytest

JOURNAL_URL = "/api/v1/journal"

CREDENTIALS = {"email": "astronaut@example.com", "password": "correct horse battery"}


@pytest.fixture
def auth_headers(client) -> dict:
    client.post("/api/v1/auth/register", json=CREDENTIALS)
    token = client.post("/api/v1/auth/login", json=CREDENTIALS).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create(client, auth_headers, title="First reflection", body="A calm day.") -> dict:
    response = client.post(
        JOURNAL_URL, json={"title": title, "body": body}, headers=auth_headers
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_list_starts_empty(client, auth_headers):
    response = client.get(JOURNAL_URL, headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["entries"] == []


def test_creating_an_entry_returns_it(client, auth_headers):
    entry = _create(client, auth_headers)

    assert entry["title"] == "First reflection"
    assert entry["body"] == "A calm day."
    assert "id" in entry and "created_at" in entry


def test_created_entry_appears_in_the_list(client, auth_headers):
    _create(client, auth_headers)
    response = client.get(JOURNAL_URL, headers=auth_headers)

    assert len(response.json()["entries"]) == 1


def test_list_is_newest_first(client, auth_headers):
    _create(client, auth_headers, title="Older")
    _create(client, auth_headers, title="Newer")

    entries = client.get(JOURNAL_URL, headers=auth_headers).json()["entries"]
    assert [e["title"] for e in entries] == ["Newer", "Older"]


def test_entry_can_be_fetched_by_id(client, auth_headers):
    created = _create(client, auth_headers)
    response = client.get(f"{JOURNAL_URL}/{created['id']}", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


def test_entry_can_be_updated(client, auth_headers):
    created = _create(client, auth_headers)
    response = client.put(
        f"{JOURNAL_URL}/{created['id']}",
        json={"title": "Revised", "body": "Updated thoughts."},
        headers=auth_headers,
    )

    assert response.status_code == 200
    assert response.json()["title"] == "Revised"


def test_entry_can_be_deleted(client, auth_headers):
    created = _create(client, auth_headers)

    assert (
        client.delete(f"{JOURNAL_URL}/{created['id']}", headers=auth_headers).status_code
        == 204
    )
    assert (
        client.get(f"{JOURNAL_URL}/{created['id']}", headers=auth_headers).status_code
        == 404
    )


def test_missing_entry_is_a_404(client, auth_headers):
    response = client.get(f"{JOURNAL_URL}/999999", headers=auth_headers)

    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"


def test_entries_are_isolated_between_users(client, auth_headers):
    created = _create(client, auth_headers)

    other_credentials = {"email": "other@example.com", "password": "another password"}
    client.post("/api/v1/auth/register", json=other_credentials)
    other_token = client.post("/api/v1/auth/login", json=other_credentials).json()[
        "access_token"
    ]
    other_headers = {"Authorization": f"Bearer {other_token}"}

    # Neither the list nor a direct fetch by id crosses accounts.
    assert client.get(JOURNAL_URL, headers=other_headers).json()["entries"] == []
    response = client.get(f"{JOURNAL_URL}/{created['id']}", headers=other_headers)
    assert response.status_code == 404


def test_unauthenticated_request_is_rejected(client):
    response = client.get(JOURNAL_URL)

    assert response.status_code == 401


def test_empty_body_is_rejected(client, auth_headers):
    response = client.post(
        JOURNAL_URL, json={"title": "Title", "body": ""}, headers=auth_headers
    )

    assert response.status_code == 422
