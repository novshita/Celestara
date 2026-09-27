"""The one saved birth profile per user (product spec §28).

Converts between the persisted row and `app.domain.birth_data.BirthData` -
the same Pydantic model the chart endpoints already accept - so a saved
profile can be handed straight to `calculate_d1_chart` and friends without a
second birth-data shape existing anywhere.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import BirthProfile, User
from app.domain.birth_data import BirthData, BirthTimeConfidence


class ProfileNotFoundError(ValueError):
    """The user has not saved a birth profile yet."""


def get_profile(db: Session, user: User) -> BirthProfile:
    """Fetch the saved profile. Raises `ProfileNotFoundError` if none exists."""
    profile = db.scalars(
        select(BirthProfile).where(BirthProfile.user_id == user.id)
    ).first()
    if profile is None:
        raise ProfileNotFoundError("no birth profile has been saved yet")
    return profile


def to_birth_data(profile: BirthProfile) -> BirthData:
    """Convert a saved profile into the shape the calculation services take."""
    return BirthData(
        birth_date=profile.birth_date,
        birth_time=profile.birth_time,
        time_confidence=BirthTimeConfidence(profile.time_confidence),
        latitude=profile.latitude,
        longitude=profile.longitude,
        timezone_name=profile.timezone_name,
    )


def save_profile(db: Session, user: User, birth: BirthData) -> BirthProfile:
    """Create or replace the user's one birth profile.

    "Replace" rather than "patch": product spec §28 allows exactly one
    profile, so there is no partial-update case to support, and building one
    would only invite a request that changes `time_confidence` without also
    changing `birth_time` into an inconsistent row.
    """
    profile = db.scalars(
        select(BirthProfile).where(BirthProfile.user_id == user.id)
    ).first()

    if profile is None:
        profile = BirthProfile(user_id=user.id)
        db.add(profile)

    profile.birth_date = birth.birth_date
    profile.birth_time = birth.birth_time
    profile.time_confidence = birth.time_confidence.value
    profile.latitude = birth.latitude
    profile.longitude = birth.longitude
    profile.timezone_name = birth.timezone_name

    db.commit()
    db.refresh(profile)
    return profile
