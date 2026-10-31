"""User preferences: explanation depth and saved calculation configuration
(product spec §24, §29)."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import DEFAULT_CALCULATION_CONFIG, CalculationConfig
from app.db.models import User, UserPreferences
from app.domain.ai import ExplanationDepth


@dataclass(frozen=True)
class Preferences:
    explanation_depth: ExplanationDepth
    calculation_config: CalculationConfig | None
    """`None` means the application default."""


DEFAULT_PREFERENCES = Preferences(ExplanationDepth.BEGINNER, None)


def _load(db: Session, user: User) -> UserPreferences | None:
    return db.scalars(
        select(UserPreferences).where(UserPreferences.user_id == user.id)
    ).first()


def get_preferences(db: Session, user: User) -> Preferences:
    """What the user has saved, or the defaults. Reading never creates a row."""
    row = _load(db, user)
    if row is None:
        return DEFAULT_PREFERENCES
    return Preferences(
        explanation_depth=ExplanationDepth(row.explanation_depth),
        calculation_config=(
            CalculationConfig.model_validate_json(row.calculation_config)
            if row.calculation_config
            else None
        ),
    )


def save_preferences(
    db: Session,
    user: User,
    explanation_depth: ExplanationDepth,
    calculation_config: CalculationConfig | None,
) -> Preferences:
    """Replace the user's preferences. A `None` configuration goes back to the
    application default."""
    row = _load(db, user)
    if row is None:
        row = UserPreferences(user_id=user.id)
        db.add(row)
    row.explanation_depth = explanation_depth.value
    row.calculation_config = (
        calculation_config.model_dump_json() if calculation_config else None
    )
    db.commit()
    return get_preferences(db, user)


def resolve(
    db: Session,
    user: User | None,
    depth: ExplanationDepth | None,
    config: CalculationConfig | None,
) -> tuple[ExplanationDepth, CalculationConfig]:
    """What a request should actually use: what it asked for, else what its
    user saved, else the defaults. An anonymous caller has no saved
    preferences, so only the request and the defaults apply."""
    saved = get_preferences(db, user) if user is not None else DEFAULT_PREFERENCES
    return (
        depth or saved.explanation_depth,
        config or saved.calculation_config or DEFAULT_CALCULATION_CONFIG,
    )
