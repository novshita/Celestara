"""Operational metrics (engineering spec §32), in Prometheus's format.

Only counts and timings, labelled by things the operator controls: the route
template, the HTTP status, an outcome name. Never a path parameter, a user,
a question, a birth record or any other request content - spec §32 asks for
health tracking "without unnecessarily storing personal content", and §20
forbids birth data in logs.

The counters are always kept (they cost a few nanoseconds); whether anyone
can read them is up to `/metrics`, which only exists when `METRICS_ENABLED`
is set (see app/api/routes/metrics.py).
"""

from __future__ import annotations

from fastapi import Request
from prometheus_client import CollectorRegistry, Counter, Histogram

#: Its own registry rather than the library default, so a library that
#: registers its own metrics cannot leak into this output.
registry = CollectorRegistry()

HTTP_REQUESTS = Counter(
    "celestara_http_requests_total",
    "HTTP requests handled, by route template and status.",
    ["method", "route", "status"],
    registry=registry,
)
HTTP_DURATION = Histogram(
    "celestara_http_request_duration_seconds",
    "HTTP request duration, by route template. Covers chart, dasha, transit "
    "and compare calculation latency, since each has its own route.",
    ["method", "route"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
    registry=registry,
)

AI_CALLS = Counter(
    "celestara_ai_calls_total",
    "Calls made to the AI provider, by outcome (ok or provider_error).",
    ["outcome"],
    registry=registry,
)
AI_DURATION = Histogram(
    "celestara_ai_call_duration_seconds",
    "Time spent waiting on the AI provider.",
    buckets=(0.5, 1, 2, 5, 10, 20, 40, 80),
    registry=registry,
)

SAFETY_EVENTS = Counter(
    "celestara_safety_events_total",
    "Safety pipeline actions: crisis, unsupported, output_replaced.",
    ["event"],
    registry=registry,
)
RATE_LIMITED = Counter(
    "celestara_rate_limited_total",
    "AI requests refused because the caller exceeded the rate limit.",
    registry=registry,
)

#: Route label for requests that matched no route. A fixed value, because a
#: label built from the raw path would give scanners an unbounded number of
#: distinct series.
UNMATCHED_ROUTE = "unmatched"


def route_label(request: Request) -> str:
    """The matched route as a template, e.g. `/api/v1/journal/{entry_id}`.

    Built from the real path with each path parameter's value swapped for its
    name, so an id can never become a label value. (The matched route's own
    `path` is not used: it omits the router prefix, so every route would show
    without `/api/v1`.)
    """
    if request.scope.get("route") is None:
        return UNMATCHED_ROUTE

    label = request.scope["path"]
    for name, value in request.scope.get("path_params", {}).items():
        label = label.replace(f"/{value}", f"/{{{name}}}", 1)
    return label
