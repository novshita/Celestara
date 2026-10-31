"""`GET /metrics`: Prometheus scrape endpoint, off unless enabled.

`METRICS_ENABLED=true` turns it on. `METRICS_TOKEN`, if set, must be sent as
`Authorization: Bearer <token>`. The numbers are aggregate and contain no
personal data, but they still describe traffic and failures, so the endpoint
is closed by default and should sit behind the same network boundary as the
rest of an operator's tooling.
"""

from __future__ import annotations

import hmac
import os

from fastapi import APIRouter, Header, HTTPException, Response, status
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.core.metrics import registry

router = APIRouter(tags=["system"])


def metrics_enabled() -> bool:
    return os.getenv("METRICS_ENABLED", "false").lower() in {"1", "true", "yes"}


@router.get("/metrics", include_in_schema=False)
def metrics(authorization: str | None = Header(default=None)) -> Response:
    token = os.getenv("METRICS_TOKEN")
    if token:
        expected = f"Bearer {token}"
        if authorization is None or not hmac.compare_digest(authorization, expected):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                headers={"WWW-Authenticate": "Bearer"},
            )
    return Response(generate_latest(registry), media_type=CONTENT_TYPE_LATEST)
