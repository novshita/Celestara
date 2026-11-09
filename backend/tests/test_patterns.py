"""Recurring themes in a user's saved questions (product spec §20)."""

from __future__ import annotations

import datetime as dt

import pytest

from app.db.models import Conversation, ConversationMessage, User
from app.domain.ai import ReadingTopic
from app.services.patterns import service
from app.services.patterns.service import MIN_QUESTIONS, WINDOW_DAYS, find_patterns

URL = "/api/v1/patterns"
EMAIL = "astronaut@example.com"

CAREER = "Is my career going to improve?"
OTHER = "What does my Moon sign mean?"


# --- The rule itself ------------------------------------------------------


def test_a_topic_below_the_threshold_is_not_a_theme():
    assert find_patterns([CAREER] * (MIN_QUESTIONS - 1)) == []


def test_a_topic_at_the_threshold_is_a_theme():
    [pattern] = find_patterns([CAREER] * MIN_QUESTIONS + [OTHER])

    assert pattern.topic is ReadingTopic.CAREER
    assert pattern.count == MIN_QUESTIONS
    assert pattern.window_days == WINDOW_DAYS


def test_only_the_most_frequent_theme_is_reported():
    questions = [CAREER] * 3 + ["Tell me about love and romance."] * 5

    [pattern] = find_patterns(questions)

    assert pattern.topic is ReadingTopic.LOVE
    assert pattern.count == 5


def test_a_tie_goes_to_the_earlier_listed_topic():
    questions = [CAREER] * 3 + ["Tell me about love."] * 3

    assert find_patterns(questions)[0].topic is ReadingTopic.CAREER


@pytest.mark.parametrize("question", ["Does astrology work?", "How does this work?"])
def test_the_word_work_alone_is_not_career(question):
    assert find_patterns([question] * 5) == []


def test_the_note_states_a_count_its_source_and_its_limits():
    [pattern] = find_patterns([CAREER] * 4)

    assert "4 of your saved questions" in pattern.note
    assert "30 days" in pattern.note
    assert "isn't a conclusion about you" in pattern.note
    for overreach in ("you are", "you will", "you always", "your personality"):
        assert overreach not in pattern.note.lower()


# --- The endpoint ----------------------------------------------------------


@pytest.fixture
def headers(make_user):
    return make_user(EMAIL)


def _save(session_factory, questions, age_days=0):
    """Save one conversation per question, `age_days` old."""
    created = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=age_days)
    with session_factory() as db:
        user = db.query(User).filter_by(email=EMAIL).one()
        for question in questions:
            conversation = Conversation(user_id=user.id, title=question[:60])
            conversation.messages.append(
                ConversationMessage(role="user", content=question, created_at=created)
            )
            conversation.messages.append(
                ConversationMessage(
                    role="assistant", content=CAREER * 5, created_at=created
                )
            )
            db.add(conversation)
        db.commit()


def test_requires_an_account(client):
    assert client.get(URL).status_code == 401


def test_nothing_to_report_without_enough_questions(client, headers, session_factory):
    _save(session_factory, [CAREER, CAREER])

    body = client.get(URL, headers=headers).json()

    assert body == {"enabled": True, "patterns": []}


def test_a_repeated_topic_is_reported(client, headers, session_factory):
    _save(session_factory, [CAREER] * 3)

    body = client.get(URL, headers=headers).json()

    assert body["enabled"] is True
    assert [p["topic"] for p in body["patterns"]] == ["career"]
    assert body["patterns"][0]["count"] == 3


def test_only_the_users_own_questions_count(client, headers, make_user, session_factory):
    other = make_user("someone-else@example.com")
    _save(session_factory, [CAREER] * 3)

    assert client.get(URL, headers=other).json() == {"enabled": True, "patterns": []}


def test_the_assistants_replies_are_not_counted(client, headers, session_factory):
    # `_save` gives every assistant reply the career vocabulary; counting
    # replies would turn three non-career questions into a career theme.
    _save(session_factory, [OTHER] * MIN_QUESTIONS)

    assert client.get(URL, headers=headers).json()["patterns"] == []


def test_old_questions_do_not_count(client, headers, session_factory):
    _save(session_factory, [CAREER] * 3, age_days=WINDOW_DAYS + 5)

    assert client.get(URL, headers=headers).json()["patterns"] == []


def test_the_user_can_turn_it_off(client, headers, session_factory):
    _save(session_factory, [CAREER] * 3)

    client.put(
        "/api/v1/preferences",
        json={"explanation_depth": "beginner", "pattern_detection": False},
        headers=headers,
    )
    body = client.get(URL, headers=headers).json()

    assert body == {"enabled": False, "patterns": []}


def test_the_deployment_can_turn_it_off(client, headers, session_factory, monkeypatch):
    _save(session_factory, [CAREER] * 3)
    monkeypatch.setenv("FEATURE_PATTERN_DETECTION", "off")

    assert client.get(URL, headers=headers).json() == {"enabled": False, "patterns": []}


def test_the_preference_is_saved_and_defaults_on(client, headers):
    prefs = "/api/v1/preferences"
    assert client.get(prefs, headers=headers).json()["pattern_detection"] is True

    client.put(
        prefs,
        json={"explanation_depth": "beginner", "pattern_detection": False},
        headers=headers,
    )
    assert client.get(prefs, headers=headers).json()["pattern_detection"] is False


def test_nothing_is_stored_about_a_theme(client, headers, session_factory):
    from sqlalchemy import inspect

    _save(session_factory, [CAREER] * 3)
    client.get(URL, headers=headers)

    with session_factory() as db:
        tables = inspect(db.get_bind()).get_table_names()
    assert not [name for name in tables if "pattern" in name]


def test_theme_text_never_reaches_the_ai_prompt():
    # Spec §20 is about what the guide may say to the user; keeping themes
    # out of the model's prompt is a deliberate choice, pinned here.
    import inspect

    from app.services.ai import service as ai_service

    assert "patterns" not in inspect.getsource(ai_service)
