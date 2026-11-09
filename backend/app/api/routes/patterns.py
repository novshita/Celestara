"""Recurring themes in the signed-in user's own saved questions."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.api.errors import AUTH_REQUIRED_RESPONSES
from app.api.schemas import PatternResponse, PatternsResponse
from app.services.patterns.service import detect_patterns

router = APIRouter(prefix="/patterns", tags=["patterns"])


@router.get(
    "",
    response_model=PatternsResponse,
    summary="Recurring themes in your saved questions",
    responses=AUTH_REQUIRED_RESPONSES,
)
def read_patterns(user: CurrentUser, db: DbSession) -> PatternsResponse:
    """At most one theme, and only when a topic has come up repeatedly in the
    last 30 days. Computed from the caller's own saved questions on every
    request and never stored; `enabled` is false when the user has turned it
    off in their preferences."""
    report = detect_patterns(db, user)
    return PatternsResponse(
        enabled=report.enabled,
        patterns=[
            PatternResponse(
                topic=pattern.topic,
                count=pattern.count,
                window_days=pattern.window_days,
                note=pattern.note,
            )
            for pattern in report.patterns
        ],
    )
