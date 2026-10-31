"""Recording how an AI answer was produced (engineering spec §22).

What is written is deliberately thin. No question, no answer, no chart value:
only which kinds of fact grounded the answer, which knowledge entries were
retrieved, how much user context was supplied, and the intent, model, safety
flags and timing (see `AiAuditRecord`). That is enough to explain an answer
or debug a pattern of them without keeping a second copy of what a person
said, which spec §20 and §32 rule out.

Two deliberate omissions:

- A crisis message is not recorded at all. A row tying a person to one is
  precisely the personal content this module exists to avoid; the anonymous
  `celestara_safety_events_total` counter already shows that they happen.
- A failure to write never fails the request. The user's answer matters more
  than its audit row.
"""

from __future__ import annotations

import logging

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.models import AiAuditRecord, User
from app.domain.ai import AnswerFactors, ExplanationDepth

logger = logging.getLogger("celestara.api")


def record_answer(
    db: Session,
    user: User | None,
    *,
    request_id: str,
    endpoint: str,
    intent: str | None,
    system: str | None,
    model: str | None,
    depth: ExplanationDepth,
    factors: AnswerFactors,
    safety_flags: tuple[str, ...],
    latency_ms: int,
) -> None:
    if "crisis" in safety_flags:
        return

    try:
        db.add(
            AiAuditRecord(
                user_id=user.id if user is not None else None,
                request_id=request_id,
                endpoint=endpoint,
                intent=intent,
                system=system,
                model=model,
                depth=depth.value,
                factor_kinds=",".join(factors.kinds),
                knowledge_ids=",".join(ref.id for ref in factors.knowledge),
                safety_flags=",".join(safety_flags),
                memory_count=factors.memory_used,
                history_turns=factors.history_turns,
                latency_ms=latency_ms,
            )
        )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("could not record an AI audit entry [request_id=%s]", request_id)
