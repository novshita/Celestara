"""FastAPI application entry point.

Run locally with:

    uvicorn app.main:app --reload

Then open http://localhost:8000/docs for the interactive API page, which
FastAPI generates from the Pydantic models.
"""

from __future__ import annotations

import logging
import time

from fastapi import FastAPI, Request
from fastapi.responses import Response

from app.api.errors import new_request_id, register_error_handlers
from app.api.routes import charts, dashas, health
from app.core.logging import configure_logging

configure_logging()

logger = logging.getLogger("celestara.api.access")

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
    response = await call_next(request)
    duration_ms = (time.perf_counter() - started) * 1000.0

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
app.include_router(charts.router, prefix=API_PREFIX)
app.include_router(dashas.router, prefix=API_PREFIX)
