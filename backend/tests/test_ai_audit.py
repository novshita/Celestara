"""The AI audit record and the transparency fields: what is kept, and, just
as important, what is not."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy.exc import OperationalError

from app.db.models import AiAuditRecord

CHAT = "/api/v1/ai/chat"
QUESTION = "What does my distinctive-zebra rising sign mean?"
BIRTH = {
    "birth_date": "1990-08-15",
    "birth_time": "14:30:00",
    "time_confidence": "EXACT",
    "latitude": 18.9756,
    "longitude": 72.8258,
    "timezone_name": "Asia/Kolkata",
}


@pytest.fixture
def mock_claude():
    with patch("app.services.ai.service.anthropic.Anthropic") as mock_cls:
        client = MagicMock()
        block = MagicMock()
        block.type = "text"
        block.text = "An answer containing the word kangaroo."
        response = MagicMock()
        response.stop_reason = "end_turn"
        response.content = [block]
        client.messages.create.return_value = response
        mock_cls.return_value = client
        yield client


@pytest.fixture
def headers(make_user):
    return make_user()


def ask(client, question=QUESTION, headers=None, system="vedic", **extra):
    return client.post(
        CHAT,
        json={"birth": BIRTH, "system": system, "question": question, **extra},
        headers=headers or {},
    )


def records(session_factory) -> list[AiAuditRecord]:
    with session_factory() as db:
        rows = db.query(AiAuditRecord).order_by(AiAuditRecord.id).all()
        db.expunge_all()
        return rows


def test_an_anonymous_answer_is_recorded_without_a_user(client, mock_claude, session_factory):
    ask(client)

    (row,) = records(session_factory)
    assert row.user_id is None
    assert row.endpoint == "chat"
    assert row.system == "vedic"
    assert row.depth == "beginner"
    assert row.factor_kinds == "natal_chart"
    assert row.knowledge_ids == "vedic-lagna"
    assert row.model
    assert row.latency_ms >= 0
    assert row.request_id


def test_a_logged_in_answer_is_recorded_against_the_user(client, mock_claude, headers, session_factory):
    ask(client, headers=headers)

    (row,) = records(session_factory)
    assert row.user_id is not None


def test_the_record_holds_no_personal_content(client, mock_claude, headers, session_factory):
    client.post("/api/v1/memory", json={"kind": "note", "content": "my secret hamster"}, headers=headers)
    ask(client, headers=headers)

    (row,) = records(session_factory)
    stored = " ".join(str(getattr(row, c.name)) for c in AiAuditRecord.__table__.columns)
    for forbidden in ("zebra", "kangaroo", "hamster", "1990", "Karka", "Simha", "18.9756", "72.8258"):
        assert forbidden not in stored


def test_the_record_counts_memory_and_history_without_keeping_them(client, mock_claude, headers, session_factory):
    client.post("/api/v1/memory", json={"kind": "note", "content": "something"}, headers=headers)
    first = ask(client, headers=headers).json()
    ask(client, "and what about my moon sign?", headers=headers, conversation_id=first["conversation_id"])

    second_row = records(session_factory)[-1]
    assert second_row.memory_count == 1
    assert second_row.history_turns == 1


def test_the_intent_and_depth_are_recorded(client, mock_claude, session_factory):
    ask(client, "Which dasha am I in?", depth="technical")

    (row,) = records(session_factory)
    assert row.intent == "dasha_question"
    assert row.depth == "technical"
    assert row.factor_kinds == "natal_chart,dasha"


def test_a_replaced_answer_records_why(client, mock_claude, session_factory):
    mock_claude.messages.create.return_value.content[0].text = "You will definitely be rich."

    ask(client)

    (row,) = records(session_factory)
    assert "certainty_claim" in row.safety_flags


def test_a_declined_request_is_recorded_with_no_model(client, mock_claude, session_factory):
    ask(client, "Write me a python script to sort a list")

    (row,) = records(session_factory)
    assert row.model is None
    assert row.intent == "unsupported"


def test_a_crisis_message_is_not_recorded_at_all(client, mock_claude, headers, session_factory):
    ask(client, "I want to kill myself", headers=headers)

    assert records(session_factory) == []


def test_a_provider_failure_is_not_recorded(client, mock_claude, session_factory):
    mock_claude.messages.create.side_effect = RuntimeError("down")

    assert ask(client).status_code == 503
    assert records(session_factory) == []


def test_a_failure_to_record_never_fails_the_answer(client, mock_claude):
    with patch("app.services.ai.audit.AiAuditRecord", side_effect=OperationalError("x", {}, Exception("db down"))):
        response = ask(client)

    assert response.status_code == 200
    assert response.json()["answer"] == "An answer containing the word kangaroo."


def test_readings_are_recorded_too(client, mock_claude, session_factory):
    client.post("/api/v1/readings/daily", json={"birth": BIRTH})
    client.post("/api/v1/readings/topic/career", json={"birth": BIRTH})

    rows = records(session_factory)
    assert [r.endpoint for r in rows] == ["daily", "topic:career"]
    assert rows[0].factor_kinds == "transits"
    assert rows[1].factor_kinds == "natal_chart,transits"
    assert all(r.intent is None for r in rows)


# --- readings: depth, memory and factors --------------------------------------------


def sent(mock_claude) -> str:
    return mock_claude.messages.create.call_args.kwargs["messages"][0]["content"]


def test_a_reading_reports_what_it_was_built_from(client, mock_claude):
    body = client.post("/api/v1/readings/weekly", json={"birth": BIRTH}).json()

    assert body["depth"] == "beginner"
    assert [g["kind"] for g in body["factors"]["calculated"]] == ["transits", "period_changes"]
    assert body["factors"]["memory_used"] == 0


def test_a_birth_chart_reading_reports_only_the_natal_chart(client, mock_claude):
    body = client.post("/api/v1/readings/topic/birth_chart", json={"birth": BIRTH}).json()

    assert [g["kind"] for g in body["factors"]["calculated"]] == ["natal_chart"]


def test_a_reading_can_be_technical(client, mock_claude):
    body = client.post("/api/v1/readings/daily", json={"birth": BIRTH, "depth": "technical"}).json()

    assert body["depth"] == "technical"
    assert "comfortable with astrological terms" in sent(mock_claude)


def test_a_reading_uses_the_saved_depth_and_memories(client, mock_claude, headers):
    client.put("/api/v1/preferences", json={"explanation_depth": "technical"}, headers=headers)
    client.post("/api/v1/memory", json={"kind": "note", "content": "I am training to be a teacher"}, headers=headers)

    body = client.post("/api/v1/readings/daily", json={"birth": BIRTH}, headers=headers).json()

    assert body["depth"] == "technical"
    assert body["factors"]["memory_used"] == 1
    assert "- I am training to be a teacher" in sent(mock_claude)


def test_a_reading_with_a_bad_token_is_a_401(client, mock_claude):
    response = client.post(
        "/api/v1/readings/daily", json={"birth": BIRTH}, headers={"Authorization": "Bearer nope"}
    )

    assert response.status_code == 401
