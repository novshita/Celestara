"""Rate limiting for the AI endpoints.

Engineering spec §33: "Rate limiting on AI endpoints." The AI routes are
open to unauthenticated callers (product spec §28) and every call spends
money with the AI provider, so without a limit anyone who can reach the API
can run up the bill.

Deliberately in-memory: the limit lives in one process, resets on restart,
and is not shared across workers. Spec §36 says not to introduce background
infrastructure (a Redis, say) until a concrete requirement exists, and a
single-process cap is enough to stop casual abuse. A multi-worker deployment
would need a shared store behind `SlidingWindowLimiter.check` - the one
method everything else calls.
"""

from __future__ import annotations

import logging
import math
import os
import threading
import time
from collections import deque
from collections.abc import Callable

from fastapi import Request

from app.core.metrics import RATE_LIMITED

logger = logging.getLogger("celestara.api")

DEFAULT_AI_LIMIT_PER_MINUTE = 10
WINDOW_SECONDS = 60.0

#: Past this many tracked clients, expired entries are swept so a stream of
#: distinct client keys cannot grow the table without bound.
_SWEEP_THRESHOLD = 10_000


class RateLimitedError(RuntimeError):
    """The caller has used up its allowance for the current window."""

    def __init__(self, retry_after_seconds: int) -> None:
        super().__init__(f"rate limited; retry in {retry_after_seconds}s")
        self.retry_after_seconds = retry_after_seconds


class SlidingWindowLimiter:
    """Allows `limit` hits per `window` seconds, per key.

    A sliding window rather than a fixed one: a fixed window lets a caller
    spend two full allowances back to back across a window boundary, which
    for a metered API means double the intended ceiling.
    """

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._hits: dict[str, deque[float]] = {}
        # FastAPI runs sync endpoints on a thread pool, so concurrent
        # requests really do race on this table.
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window: float) -> float | None:
        """Record a hit for `key`.

        Returns None if the hit is allowed, or the number of seconds until
        the oldest recorded hit leaves the window if it is not. A rejected
        hit is not recorded, so being refused never extends the wait.
        """
        now = self._clock()
        cutoff = now - window

        with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and hits[0] <= cutoff:
                hits.popleft()

            if len(hits) >= limit:
                return hits[0] + window - now

            hits.append(now)

            if len(self._hits) > _SWEEP_THRESHOLD:
                self._sweep(cutoff)
            return None

    def _sweep(self, cutoff: float) -> None:
        stale = [k for k, h in self._hits.items() if not h or h[-1] <= cutoff]
        for key in stale:
            del self._hits[key]

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


#: One limiter shared by every AI route, so a client's chat and reading
#: requests draw from the same allowance - the thing being protected is the
#: provider bill, which does not care which endpoint spent it.
ai_rate_limiter = SlidingWindowLimiter()


def _limit_per_minute() -> int:
    """Read at call time so a deployment (or a test) can change it without
    re-importing. `0` disables limiting."""
    raw = os.getenv("AI_RATE_LIMIT_PER_MINUTE")
    if raw is None:
        return DEFAULT_AI_LIMIT_PER_MINUTE
    try:
        return int(raw)
    except ValueError:
        # Refusing every request over a typo'd setting would be worse than
        # running with the default, but it must not be silent.
        logger.warning(
            "AI_RATE_LIMIT_PER_MINUTE=%r is not an integer; using %d",
            raw,
            DEFAULT_AI_LIMIT_PER_MINUTE,
        )
        return DEFAULT_AI_LIMIT_PER_MINUTE


def _client_key(request: Request) -> str:
    """Who this request counts against.

    By default the connecting address. The frontend calls this API from its
    own server, so behind it every end user shares one address and therefore
    one allowance; setting RATE_LIMIT_TRUST_FORWARDED_FOR makes the key the
    address the proxy in front of the API recorded in `X-Forwarded-For`.

    Off by default because the header is client-controlled: trusting it
    when nothing in front of the API sets it lets any caller pick a fresh
    key per request and never be limited. Only the last entry is used - the
    one appended by the nearest proxy - so this assumes exactly one trusted
    proxy hop; anything to its left is whatever the client chose to send.
    """
    trust = os.getenv("RATE_LIMIT_TRUST_FORWARDED_FOR", "").strip().lower()
    if trust in {"1", "true", "yes"}:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[-1].strip()

    return request.client.host if request.client else "unknown"


def enforce_ai_rate_limit(request: Request) -> None:
    """Charge one request against the caller's AI allowance, or raise.

    Used as a router dependency by the readings, where it runs before the
    body is validated - so malformed requests use up allowance too; they
    cost nothing, but they are also the cheapest way to hammer an endpoint.
    `/ai/chat` calls it from the handler instead, after its crisis check,
    so a crisis message is never rate limited (see that route).
    """
    limit = _limit_per_minute()
    if limit <= 0:
        return

    retry_after = ai_rate_limiter.check(_client_key(request), limit, WINDOW_SECONDS)
    if retry_after is not None:
        RATE_LIMITED.inc()
        raise RateLimitedError(max(1, math.ceil(retry_after)))
