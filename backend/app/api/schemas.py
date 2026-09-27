"""API request and response models.

Kept separate from the domain models so the wire format can carry examples and
API-specific documentation without those concerns leaking into the calculation
layer. Responses reuse the domain models directly - the whole point of the
calculation services returning structured data is that it is already the right
shape to send.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.core.config import CalculationConfig
from app.domain.birth_data import BirthData
from app.domain.compare import ChartComparison
from app.domain.dasha import DashaPeriod, DashaTimeline
from app.domain.transit import TransitReport, TransitSnapshot
from app.domain.vedic import VedicChart
from app.domain.western import WesternChart


class VedicChartRequest(BaseModel):
    """A request for a D1 / Rashi chart."""

    birth: BirthData

    config: CalculationConfig | None = Field(
        default=None,
        description=(
            "Optional calculation overrides. Omit to use the validated "
            "defaults (Lahiri ayanamsa, whole-sign bhavas). Intended for "
            "advanced users per product spec §24."
        ),
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "summary": "Exact birth time",
                    "description": "A complete record with a known time.",
                    "value": {
                        "birth": {
                            "birth_date": "1990-08-15",
                            "birth_time": "14:30:00",
                            "time_confidence": "EXACT",
                            "latitude": 18.9756,
                            "longitude": 72.8258,
                            "timezone_name": "Asia/Kolkata",
                        }
                    },
                },
                {
                    "summary": "Unknown birth time",
                    "description": (
                        "Omit birth_time and set confidence to UNKNOWN. The "
                        "response will contain no ascendant and no bhavas, and "
                        "will list them under metadata.unavailable."
                    ),
                    "value": {
                        "birth": {
                            "birth_date": "1990-08-15",
                            "time_confidence": "UNKNOWN",
                            "latitude": 18.9756,
                            "longitude": 72.8258,
                        }
                    },
                },
                {
                    "summary": "Timezone resolved from coordinates",
                    "description": "Omit timezone_name to have it looked up.",
                    "value": {
                        "birth": {
                            "birth_date": "1985-03-21",
                            "birth_time": "06:15:00",
                            "time_confidence": "ESTIMATED",
                            "latitude": 28.6139,
                            "longitude": 77.2090,
                        }
                    },
                },
            ]
        }
    }


class VedicChartResponse(BaseModel):
    """A calculated D1 chart."""

    chart: VedicChart


class WesternChartRequest(BaseModel):
    """A request for a Western natal chart."""

    birth: BirthData

    config: CalculationConfig | None = Field(
        default=None,
        description=(
            "Optional overrides. The ones worth knowing about here are "
            "`western_house_system` (Placidus by default, configured "
            "separately from the Vedic bhava division), `include_outer_"
            "planets`, and the aspect orbs."
        ),
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "summary": "Default settings",
                    "description": "Placidus houses, outer planets included.",
                    "value": {
                        "birth": {
                            "birth_date": "1990-08-15",
                            "birth_time": "14:30:00",
                            "time_confidence": "EXACT",
                            "latitude": 18.9756,
                            "longitude": 72.8258,
                            "timezone_name": "Asia/Kolkata",
                        }
                    },
                },
                {
                    "summary": "Classical: equal houses, no outer planets",
                    "description": (
                        "Uranus, Neptune and Pluto are invisible to the naked "
                        "eye and absent from classical Western astrology."
                    ),
                    "value": {
                        "birth": {
                            "birth_date": "1990-08-15",
                            "birth_time": "14:30:00",
                            "time_confidence": "EXACT",
                            "latitude": 18.9756,
                            "longitude": 72.8258,
                            "timezone_name": "Asia/Kolkata",
                        },
                        "config": {
                            "western_house_system": "equal",
                            "include_outer_planets": False,
                        },
                    },
                },
            ]
        }
    }


class WesternChartResponse(BaseModel):
    """A calculated Western natal chart."""

    chart: WesternChart


class CompareChartRequest(BaseModel):
    """A request for the Vedic and Western charts, side by side."""

    birth: BirthData

    config: CalculationConfig | None = Field(
        default=None,
        description=(
            "Optional overrides, applied to both pipelines - e.g. "
            "`western_house_system` for the Western half and `house_system` "
            "for the Vedic half. Omit to use the validated defaults."
        ),
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "summary": "Exact birth time",
                    "value": {
                        "birth": {
                            "birth_date": "1990-08-15",
                            "birth_time": "14:30:00",
                            "time_confidence": "EXACT",
                            "latitude": 18.9756,
                            "longitude": 72.8258,
                            "timezone_name": "Asia/Kolkata",
                        }
                    },
                },
                {
                    "summary": "Unknown birth time",
                    "description": (
                        "Both charts still come back. `ascendant` is omitted "
                        "from the comparison and listed in "
                        "metadata.unavailable, since neither system has one "
                        "without a birth time."
                    ),
                    "value": {
                        "birth": {
                            "birth_date": "1990-08-15",
                            "time_confidence": "UNKNOWN",
                            "latitude": 18.9756,
                            "longitude": 72.8258,
                        }
                    },
                },
            ]
        }
    }


class CompareChartResponse(BaseModel):
    """The Vedic chart, the Western chart, and how they differ."""

    comparison: ChartComparison


class VimshottariRequest(BaseModel):
    """A request for a Vimshottari Dasha timeline."""

    birth: BirthData

    config: CalculationConfig | None = Field(
        default=None,
        description=(
            "Optional overrides. `dasha_year_length` is the one worth knowing "
            "about: traditions disagree over whether a Dasha year is 360 "
            "days, a Julian year or a sidereal year, and over a 120-year "
            "cycle the choice moves period boundaries by more than a year."
        ),
    )

    as_of: datetime | None = Field(
        default=None,
        description=(
            "Moment to report the active period for. Defaults to now. Naive "
            "values are read as UTC."
        ),
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "summary": "Default settings",
                    "description": "Julian years, Mahadasha plus Antardasha.",
                    "value": {
                        "birth": {
                            "birth_date": "1990-08-15",
                            "birth_time": "14:30:00",
                            "time_confidence": "EXACT",
                            "latitude": 18.9756,
                            "longitude": 72.8258,
                            "timezone_name": "Asia/Kolkata",
                        }
                    },
                },
                {
                    "summary": "Traditional 360-day years, three levels deep",
                    "description": (
                        "Adds Pratyantardasha. Each level multiplies the "
                        "period count by nine."
                    ),
                    "value": {
                        "birth": {
                            "birth_date": "1990-08-15",
                            "birth_time": "14:30:00",
                            "time_confidence": "EXACT",
                            "latitude": 18.9756,
                            "longitude": 72.8258,
                            "timezone_name": "Asia/Kolkata",
                        },
                        "config": {
                            "dasha_year_length": "savana",
                            "dasha_levels": 3,
                        },
                    },
                },
            ]
        }
    }


class VimshottariResponse(BaseModel):
    """A calculated Vimshottari timeline."""

    timeline: DashaTimeline

    as_of: datetime
    """The moment `active_now` was evaluated at."""

    active_now: tuple[DashaPeriod, ...] = ()
    """The period lineage in effect at `as_of`, outermost first. Empty when
    `as_of` falls outside the generated cycle."""


class TransitSnapshotResponse(BaseModel):
    """Graha positions at a moment, with no reference to any birth chart."""

    snapshot: TransitSnapshot


class TransitReportRequest(BaseModel):
    """A request for transits relative to a natal chart."""

    birth: BirthData
    config: CalculationConfig | None = None

    at: datetime | None = Field(
        default=None,
        description=(
            "Moment to calculate transits for. Defaults to now. Naive values "
            "are read as UTC, and the moment is rounded down to the minute."
        ),
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "summary": "Transits now",
                    "value": {
                        "birth": {
                            "birth_date": "1990-08-15",
                            "birth_time": "14:30:00",
                            "time_confidence": "EXACT",
                            "latitude": 18.9756,
                            "longitude": 72.8258,
                            "timezone_name": "Asia/Kolkata",
                        }
                    },
                },
                {
                    "summary": "Unknown birth time",
                    "description": (
                        "Still works. Transiting positions depend on the "
                        "present moment, not the birth, so only the "
                        "natal-relative fields are withheld."
                    ),
                    "value": {
                        "birth": {
                            "birth_date": "1990-08-15",
                            "time_confidence": "UNKNOWN",
                            "latitude": 18.9756,
                            "longitude": 72.8258,
                        }
                    },
                },
            ]
        }
    }


class TransitReportResponse(BaseModel):
    """Transits related to a natal chart."""

    report: TransitReport


class HealthResponse(BaseModel):
    """Liveness check."""

    status: str
    calculation_version: str
    engine_id: str


# --- Auth -------------------------------------------------------------


class RegisterRequest(BaseModel):
    """Create an account."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class LoginRequest(BaseModel):
    """Exchange credentials for a session token."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class AuthTokenResponse(BaseModel):
    """A bearer token. Send it as `Authorization: Bearer <token>`."""

    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    """The account created by registration."""

    model_config = {"from_attributes": True}

    id: int
    email: EmailStr
    created_at: datetime


# --- Birth profile -------------------------------------------------------


class SaveProfileRequest(BaseModel):
    """Create or replace the user's one saved birth profile."""

    birth: BirthData


class BirthProfileResponse(BaseModel):
    """The saved profile, in the same shape the chart endpoints accept."""

    id: int
    birth: BirthData
    created_at: datetime
    updated_at: datetime


# --- Journal ---------------------------------------------------------------


class JournalEntryRequest(BaseModel):
    """Create or replace a journal entry's content."""

    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=20_000)


class JournalEntryResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    title: str
    body: str
    created_at: datetime
    updated_at: datetime


class JournalEntryListResponse(BaseModel):
    entries: tuple[JournalEntryResponse, ...]
