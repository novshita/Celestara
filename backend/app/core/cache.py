"""A small in-process cache for reproducible calculations (engineering spec §28).

What it may hold is deliberately narrow. A natal chart, a Dasha timeline or a
comparison is a pure function of its inputs (birth data + calculation
configuration), so serving a stored result is indistinguishable from
recalculating it. Anything that depends on the clock (transits, a reading)
or on who is asking does not belong here.

Spec rules, and how each is met:

- *Cache keys include the calculation configuration and version.* The key is
  the whole `(BirthData, CalculationConfig)` pair, and `CalculationConfig`
  carries `calculation_version`. A change to the numbers bumps the version,
  so an old entry can never answer for the new engine - and entries die with
  the process on deploy anyway.
- *Never cache private user data across users.* Nothing is keyed by, or
  returned for, a user: an entry is served only to a caller who supplied the
  identical inputs, and the result is what they would have calculated
  themselves. Entries live in memory only (never written to disk or the
  database), expire after `ttl_seconds`, and the cache is bounded, so birth
  data does not linger.

`CALCULATION_CACHE_SIZE` (default 256, `0` disables) and
`CALCULATION_CACHE_TTL_SECONDS` (default 900) configure it, per §37's
"cache configuration".
"""

from __future__ import annotations

import os
import threading
import time
from collections import OrderedDict
from collections.abc import Callable, Hashable
from functools import wraps
from typing import Any, TypeVar

from app.core.config import DEFAULT_CALCULATION_CONFIG, CalculationConfig
from app.core.metrics import CACHE_LOOKUPS

T = TypeVar("T")

DEFAULT_SIZE = 256
DEFAULT_TTL_SECONDS = 900.0


class TTLCache:
    """Least-recently-used, size-bounded, with a time limit per entry.

    Thread-safe: FastAPI runs sync endpoints on a thread pool, so lookups
    from different requests interleave.
    """

    def __init__(
        self,
        max_size: int,
        ttl_seconds: float,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._max_size = max_size
        self._ttl = ttl_seconds
        self._clock = clock
        self._entries: OrderedDict[Hashable, tuple[float, Any]] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: Hashable) -> tuple[bool, Any]:
        """`(True, value)` on a live hit, else `(False, None)`."""
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return False, None
            stored_at, value = entry
            if self._clock() - stored_at > self._ttl:
                del self._entries[key]
                return False, None
            self._entries.move_to_end(key)
            return True, value

    def put(self, key: Hashable, value: Any) -> None:
        if self._max_size <= 0:
            return
        with self._lock:
            self._entries[key] = (self._clock(), value)
            self._entries.move_to_end(key)
            while len(self._entries) > self._max_size:
                self._entries.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def __len__(self) -> int:
        return len(self._entries)


def _env_number(name: str, default: float) -> float:
    try:
        return float(os.environ[name])
    except (KeyError, ValueError):
        return default


_registered: list[TTLCache] = []


def clear_calculation_caches() -> None:
    """Empty every calculation cache (tests, and any operator tooling)."""
    for cache in _registered:
        cache.clear()


def cached_calculation(name: str) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Cache a `(birth, config, engine=None)` calculation by `(birth, config)`.

    A call that passes its own `engine` is never cached: a caller supplying an
    engine (a test double, a different ephemeris) is asking for something the
    `(birth, config)` key does not describe.
    """

    def decorator(function: Callable[..., T]) -> Callable[..., T]:
        cache = TTLCache(
            int(_env_number("CALCULATION_CACHE_SIZE", DEFAULT_SIZE)),
            _env_number("CALCULATION_CACHE_TTL_SECONDS", DEFAULT_TTL_SECONDS),
        )
        _registered.append(cache)

        @wraps(function)
        def wrapper(
            birth: Any,
            config: CalculationConfig = DEFAULT_CALCULATION_CONFIG,
            engine: Any = None,
        ) -> T:
            if engine is not None:
                return function(birth, config, engine)
            key = (birth, config)
            hit, value = cache.get(key)
            if hit:
                CACHE_LOOKUPS.labels(name, "hit").inc()
                return value
            CACHE_LOOKUPS.labels(name, "miss").inc()
            result = function(birth, config)
            cache.put(key, result)
            return result

        return wrapper

    return decorator
