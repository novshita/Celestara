"""FastAPI application entry point.

Run locally with:

    uvicorn app.main:app --reload

Then open http://localhost:8000/docs for the interactive API page, which
FastAPI generates from the Pydantic models.
"""

from __future__ import annotations

import logging
import os
import time

from fastapi import FastAPI, Request
from fastapi.responses import Response

from app.api.errors import new_request_id, register_error_handlers
from app.api.routes import (
    account,
    ai,
    auth,
    charts,
    dashas,
    health,
    journal,
    metrics,
    profile,
    readings,
    transits,
)
from app.core.logging import configure_logging
from app.core.metrics import HTTP_DURATION, HTTP_REQUESTS, route_label
from app.db.migrate import upgrade_to_head

configure_logging()

logger = logging.getLogger("celestara.api.access")

# Applies any pending schema migrations (app/db/migrations). Set
# AUTO_MIGRATE=false to skip this and run `alembic upgrade head` yourself
# instead - needed when several workers start at once, since two of them
# migrating simultaneously would race.
if os.getenv("AUTO_MIGRATE", "true").lower() not in {"0", "false", "no"}:
    upgrade_to_head()

API_PREFIX = "/api/v1"

app = FastAPI(
    title="Celestara API",
    version="0.1.0",
    description=(
        "Deterministic Vedic and Western astrology calculation.\n\n"
        "The calculation engine calculates, the AI interprets, the user "
        "decides. Every chart response carries the configuration and engine "
        "version that produced it, so any result can be reproduced."
    ),
    docs_url="/docs",
    openapi_url="/openapi.json",
)


@app.middleware("http")
async def attach_request_id(request: Request, call_next) -> Response:
    """Give every request a traceable id and log it (engineering spec §32).

    Every request is logged, not just failures: an id returned to a client is
    useless if there is no matching log line, and a user reporting a 422 needs
    to be traceable just as much as one reporting a 500.

    What is deliberately *not* logged is request content. Spec §20 forbids
    putting private birth data in logs, so this records only method, path,
    status and duration - never the body, and never the query string, which is
    where birth data would end up if a future endpoint accepts it via GET.
    """
    request_id = request.headers.get("X-Request-Id") or new_request_id()
    request.state.request_id = request_id

    started = time.perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
    finally:
        # Recorded even when the request blew up, as a 500: a failure that
        # never produced a response is still a failure.
        elapsed = time.perf_counter() - started
        # The route *template* ("/journal/{entry_id}"), never the raw path,
        # so ids cannot become labels - and 404s all share one.
        route = route_label(request)
        HTTP_REQUESTS.labels(request.method, route, str(status_code)).inc()
        HTTP_DURATION.labels(request.method, route).observe(elapsed)
    duration_ms = elapsed * 1000.0

    logger.info(
        "%s %s -> %d [request_id=%s] %.1fms",
        request.method,
        request.url.path,
        response.status_code,
        request_id,
        duration_ms,
    )

    response.headers["X-Request-Id"] = request_id
    return response


register_error_handlers(app)

app.include_router(health.router)
if metrics.metrics_enabled():
    app.include_router(metrics.router)
app.include_router(charts.router, prefix=API_PREFIX)
app.include_router(dashas.router, prefix=API_PREFIX)
app.include_router(transits.router, prefix=API_PREFIX)
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(profile.router, prefix=API_PREFIX)
app.include_router(journal.router, prefix=API_PREFIX)
app.include_router(account.router, prefix=API_PREFIX)
app.include_router(ai.router, prefix=API_PREFIX)
app.include_router(readings.router, prefix=API_PREFIX)
