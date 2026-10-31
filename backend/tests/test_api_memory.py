"""User-controlled memory."""

from __future__ import annotations

import pytest

URL = "/api/v1/memory"


@pytest.fixture
def headers(make_user):
    return make_user()


def _add(client, headers, content="I prefer plain language", kind="preference"):
    response = client.post(URL, json={"kind": kind, "content": content}, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_memory_requires_an_account(client):
    assert client.get(URL).status_code == 401
    assert client.post(URL, json={"kind": "note", "content": "x"}).status_code == 401
    assert client.delete(URL).status_code == 401


def test_starts_empty(client, headers):
    assert client.get(URL, headers=headers).json()["memories"] == []


def test_adding_returns_it_and_lists_it_newest_first(client, headers):
    first = _add(client, headers, "first")
    second = _add(client, headers, "second", kind="note")

    assert first["kind"] == "preference" and first["content"] == "first"
    listed = client.get(URL, headers=headers).json()["memories"]
    assert [m["content"] for m in listed] == ["second", "first"]
    assert second["id"] != first["id"]


@pytest.mark.parametrize(
    "body",
    [
        {"kind": "secret", "content": "x"},
        {"kind": "note", "content": ""},
        {"kind": "note", "content": "x" * 501},
        {"content": "no kind"},
    ],
)
def test_invalid_memories_are_rejected(client, headers, body):
    assert client.post(URL, json=body, headers=headers).status_code == 422


def test_deleting_one(client, headers):
    keep, drop = _add(client, headers, "keep"), _add(client, headers, "drop")

    assert client.delete(f"{URL}/{drop['id']}", headers=headers).status_code == 204

    assert [m["id"] for m in client.get(URL, headers=headers).json()["memories"]] == [keep["id"]]


def test_deleting_a_missing_memory_is_a_404(client, headers):
    assert client.delete(f"{URL}/9999", headers=headers).status_code == 404


def test_forget_everything(client, headers):
    _add(client, headers, "a")
    _add(client, headers, "b")

    assert client.delete(URL, headers=headers).status_code == 204
    assert client.get(URL, headers=headers).json()["memories"] == []


def test_memories_are_private_to_their_user(client, make_user):
    alice, bob = make_user("alice@example.com"), make_user("bob@example.com")
    mine = _add(client, alice, "alice only")

    assert client.get(URL, headers=bob).json()["memories"] == []
    # Another user's id looks exactly like one that does not exist.
    assert client.delete(f"{URL}/{mine['id']}", headers=bob).status_code == 404
    assert len(client.get(URL, headers=alice).json()["memories"]) == 1

    client.delete(URL, headers=bob)
    assert len(client.get(URL, headers=alice).json()["memories"]) == 1


def test_there_is_a_limit_per_user(client, headers, monkeypatch):
    monkeypatch.setattr("app.services.memory.service.MAX_MEMORIES", 3)
    for i in range(3):
        _add(client, headers, f"m{i}")

    response = client.post(URL, json={"kind": "note", "content": "one too many"}, headers=headers)

    assert response.status_code == 409
    assert response.json()["code"] == "LIMIT_REACHED"


def test_the_limit_is_per_user(client, make_user, monkeypatch):
    monkeypatch.setattr("app.services.memory.service.MAX_MEMORIES", 1)
    alice, bob = make_user("alice@example.com"), make_user("bob@example.com")
    _add(client, alice, "a")

    assert client.post(URL, json={"kind": "note", "content": "b"}, headers=bob).status_code == 201


def test_memories_go_with_the_account(client, headers, session_factory):
    from app.db.models import Memory

    _add(client, headers)
    assert client.delete("/api/v1/account/data", headers=headers).status_code == 204

    with session_factory() as db:
        assert db.query(Memory).count() == 0
