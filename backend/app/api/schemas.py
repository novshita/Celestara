"""API request and response models.

Kept separate from the domain models so the wire format can carry examples and
API-specific documentation without those concerns leaking into the calculation
layer. Responses reuse the domain models directly - the whole point of the
calculation services returning structured data is that it is already the right
shape to send.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.core.config import CalculationConfig
from app.domain.birth_data import BirthData
from app.domain.vedic import VedicChart


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


class HealthResponse(BaseModel):
    """Liveness check."""

    status: str
    calculation_version: str
    engine_id: str
