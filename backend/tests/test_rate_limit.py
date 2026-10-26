"""Rate limiting on the AI endpoints.

Two layers: `SlidingWindowLimiter` on its own with a fake clock (so window
expiry is tested without sleeping), then the API behaviour with the
Anthropic client patched out, same as `test_api_ai.py`.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.core.rate_limit import SlidingWindowLimiter
from app.main import app

BIRTH = {
    "birth_date": "1990-08-15",
    "birth_time": "14:30:00",
    "time_confidence": "EXACT",
    "latitude": 18.9756,
    "longitude": 72.8258,
    "timezone_name": "Asia/Kolkata",
}

CHAT = ("/api/v1/ai/chat", {"birth": BIRTH, "system": "vedic", "question": "Hi?"})
DAILY = ("/api/v1/readings/daily", {"birth": BIRTH})
WEEKLY = ("/api/v1/readings/weekly", {"birth": BIRTH})
MONTHLY = ("/api/v1/readings/monthly", {"birth": BIRTH})
AI_ROUTES = [CHAT, DAILY, WEEKLY, MONTHLY]


# --- The limiter itself ----------------------------------------------------


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_allows_up_to_the_limit_then_refuses():
    limiter = SlidingWindowLimiter(clock=FakeClock())

    assert limiter.check("a", limit=3, window=60) is None
    assert limiter.check("a", limit=3, window=60) is None
    assert limiter.check("a", limit=3, window=60) is None
    assert limiter.check("a", limit=3, window=60) is not None


def test_refusal_reports_the_wait_until_the_oldest_hit_expires():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(clock=clock)

    limiter.check("a", limit=2, window=60)
    clock.now += 10
    limiter.check("a", limit=2, window=60)
    clock.now += 5

    # Oldest hit was 15s ago, so it leaves the window in 45s.
    assert limiter.check("a", limit=2, window=60) == pytest.approx(45.0)


def test_allowance_returns_as_hits_leave_the_window():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(clock=clock)

    limiter.check("a", limit=1, window=60)
    assert limiter.check("a", limit=1, window=60) is not None

    clock.now += 60
    assert limiter.check("a", limit=1, window=60) is None


def test_is_a_sliding_window_not_a_fixed_one():
    """A fixed window would let a caller spend two allowances back to back
    across the boundary - the ceiling a metered API actually needs is
    'never more than `limit` in any 60 seconds'."""
    clock = FakeClock()
    limiter = SlidingWindowLimiter(clock=clock)

    clock.now += 59
    assert limiter.check("a", limit=1, window=60) is None
    clock.now += 2  # crosses a would-be fixed boundary, but only 2s later
    assert limiter.check("a", limit=1, window=60) is not None


def test_refused_hits_do_not_extend_the_wait():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(clock=clock)

    limiter.check("a", limit=1, window=60)
    clock.now += 30
    for _ in range(5):
        limiter.check("a", limit=1, window=60)

    clock.now += 30
    assert limiter.check("a", limit=1, window=60) is None


def test_keys_are_independent():
    limiter = SlidingWindowLimiter(clock=FakeClock())

    limiter.check("a", limit=1, window=60)

    assert limiter.check("a", limit=1, window=60) is not None
    assert limiter.check("b", limit=1, window=60) is None


def test_reset_clears_everything():
    limiter = SlidingWindowLimiter(clock=FakeClock())
    limiter.check("a", limit=1, window=60)

    limiter.reset()

    assert limiter.check("a", limit=1, window=60) is None


def test_stale_clients_are_swept_once_the_table_is_large(monkeypatch):
    monkeypatch.setattr("app.core.rate_limit._SWEEP_THRESHOLD", 5)
    clock = FakeClock()
    limiter = SlidingWindowLimiter(clock=clock)

    for i in range(5):
        limiter.check(f"old-{i}", limit=1, window=60)
    clock.now += 120
    limiter.check("new-1", limit=1, window=60)
    limiter.check("new-2", limit=1, window=60)

    assert set(limiter._hits) == {"new-1", "new-2"}


# --- Through the API -----------------------------------------------------


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def mock_claude():
    with patch("app.services.ai.service.anthropic.Anthropic") as mock_cls:
        block = MagicMock()
        block.type = "text"
        block.text = "An answer."
        response = MagicMock()
        response.stop_reason = "end_turn"
        response.content = [block]

        mock_client = MagicMock()
        mock_client.messages.create.return_value = response
        mock_cls.return_value = mock_client
        yield mock_client


def _post(client, route, headers=None):
    url, payload = route
    return client.post(url, json=payload, headers=headers or {})


def test_requests_past_the_limit_get_a_429(client, mock_claude, monkeypatch):
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "2")

    statuses = [_post(client, CHAT).status_code for _ in range(3)]

    assert statuses == [200, 200, 429]


def test_the_429_uses_the_standard_error_shape(client, mock_claude, monkeypatch):
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "1")
    _post(client, CHAT)

    response = _post(client, CHAT)

    assert response.status_code == 429
    body = response.json()
    assert body["code"] == "RATE_LIMITED"
    assert "Please wait" in body["message"]
    assert body["request_id"]


def test_the_429_carries_a_retry_after_header(client, mock_claude, monkeypatch):
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "1")
    _post(client, CHAT)

    response = _post(client, CHAT)

    retry_after = int(response.headers["Retry-After"])
    assert 1 <= retry_after <= 60
    assert str(retry_after) in response.json()["message"]


def test_a_limited_request_never_reaches_the_provider(
    client, mock_claude, monkeypatch
):
    """The whole point: a refused request must not cost anything."""
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "1")
    _post(client, CHAT)
    _post(client, CHAT)
    _post(client, CHAT)

    assert mock_claude.messages.create.call_count == 1


@pytest.mark.parametrize("route", AI_ROUTES, ids=[r[0] for r in AI_ROUTES])
def test_every_ai_route_is_limited(client, mock_claude, monkeypatch, route):
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "1")

    assert _post(client, route).status_code == 200
    assert _post(client, route).status_code == 429


def test_all_ai_routes_share_one_allowance(client, mock_claude, monkeypatch):
    """The thing being protected is the provider bill, which doesn't care
    which endpoint spent it."""
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "2")

    assert _post(client, CHAT).status_code == 200
    assert _post(client, DAILY).status_code == 200
    assert _post(client, WEEKLY).status_code == 429


def test_non_ai_endpoints_are_not_limited(client, monkeypatch):
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "1")

    statuses = [client.get("/health").status_code for _ in range(5)]
    chart = client.post("/api/v1/charts/vedic", json={"birth": BIRTH})
    chart_again = client.post("/api/v1/charts/vedic", json={"birth": BIRTH})

    assert statuses == [200] * 5
    assert chart.status_code == chart_again.status_code == 200


def test_default_limit_applies_when_unconfigured(client, mock_claude, monkeypatch):
    monkeypatch.delenv("AI_RATE_LIMIT_PER_MINUTE", raising=False)

    statuses = [_post(client, CHAT).status_code for _ in range(11)]

    assert statuses == [200] * 10 + [429]


def test_zero_disables_limiting(client, mock_claude, monkeypatch):
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "0")

    statuses = [_post(client, CHAT).status_code for _ in range(15)]

    assert statuses == [200] * 15


def test_an_invalid_setting_falls_back_to_the_default_not_a_500(
    client, mock_claude, monkeypatch
):
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "ten")

    statuses = [_post(client, CHAT).status_code for _ in range(11)]

    assert statuses == [200] * 10 + [429]


# --- Who counts as the same client -------------------------------------


def test_forwarded_for_is_ignored_by_default(client, mock_claude, monkeypatch):
    """Otherwise any caller could pick a fresh key per request and never be
    limited."""
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "1")
    monkeypatch.delenv("RATE_LIMIT_TRUST_FORWARDED_FOR", raising=False)

    first = _post(client, CHAT, headers={"X-Forwarded-For": "1.1.1.1"})
    second = _post(client, CHAT, headers={"X-Forwarded-For": "2.2.2.2"})

    assert (first.status_code, second.status_code) == (200, 429)


def test_trusted_forwarded_for_separates_clients(client, mock_claude, monkeypatch):
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "1")
    monkeypatch.setenv("RATE_LIMIT_TRUST_FORWARDED_FOR", "true")

    a_first = _post(client, CHAT, headers={"X-Forwarded-For": "1.1.1.1"})
    a_again = _post(client, CHAT, headers={"X-Forwarded-For": "1.1.1.1"})
    b_first = _post(client, CHAT, headers={"X-Forwarded-For": "2.2.2.2"})

    assert a_first.status_code == 200
    assert a_again.status_code == 429
    assert b_first.status_code == 200


def test_a_spoofed_leftmost_entry_does_not_evade_the_limit(
    client, mock_claude, monkeypatch
):
    """Only the entry the trusted proxy appended (the last) is believed;
    anything to its left is whatever the client chose to send."""
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "1")
    monkeypatch.setenv("RATE_LIMIT_TRUST_FORWARDED_FOR", "1")

    first = _post(client, CHAT, headers={"X-Forwarded-For": "6.6.6.6, 1.1.1.1"})
    second = _post(client, CHAT, headers={"X-Forwarded-For": "7.7.7.7, 1.1.1.1"})

    assert (first.status_code, second.status_code) == (200, 429)


def test_trusted_mode_without_the_header_falls_back_to_the_peer(
    client, mock_claude, monkeypatch
):
    monkeypatch.setenv("AI_RATE_LIMIT_PER_MINUTE", "1")
    monkeypatch.setenv("RATE_LIMIT_TRUST_FORWARDED_FOR", "1")

    statuses = [_post(client, CHAT).status_code for _ in range(2)]

    assert statuses == [200, 429]


# --- Docs -----------------------------------------------------------------


@pytest.mark.parametrize("route", AI_ROUTES, ids=[r[0] for r in AI_ROUTES])
def test_the_429_is_documented(client, route):
    schema = client.get("/openapi.json").json()

    assert "429" in schema["paths"][route[0]]["post"]["responses"]
