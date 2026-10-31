"""API request and response models.

Kept separate from the domain models so the wire format can carry examples and
API-specific documentation without those concerns leaking into the calculation
layer. Responses reuse the domain models directly - the whole point of the
calculation services returning structured data is that it is already the right
shape to send.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.config import CalculationConfig
from app.domain.ai import ExplanationDepth, Intent, ReadingTopic
from app.domain.birth_data import BirthData
from app.domain.compare import ChartComparison
from app.domain.dasha import DashaPeriod, DashaTimeline
from app.domain.transit import GrahaTransit, TransitReport, TransitSnapshot
from app.domain.vedic import GrahaPlacement, VedicChart
from app.domain.western import Aspect, PlanetPosition, WesternChart


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


# --- Transparency (product spec §23) ---------------------------------------------


class FactGroupResponse(BaseModel):
    """A set of calculated facts the answer was built from."""

    model_config = {"from_attributes": True}

    kind: Literal["natal_chart", "transits", "period_changes", "dasha", "unavailable"]
    facts: tuple[str, ...]


class KnowledgeReferenceResponse(BaseModel):
    """A curated knowledge entry that was retrieved for the answer."""

    model_config = {"from_attributes": True}

    id: str
    title: str
    category: str
    version: int


class AnswerFactorsResponse(BaseModel):
    """What an answer was built from, so it can be traced back (product spec
    §23). The four layers the spec asks to keep apart map to: `calculated`
    (the chart facts), `knowledge` (the traditional interpretation), the
    answer text itself (the AI's explanation), and `memory_used` plus
    `history_turns` (what was specific to this person)."""

    model_config = {"from_attributes": True}

    calculated: tuple[FactGroupResponse, ...] = ()
    knowledge: tuple[KnowledgeReferenceResponse, ...] = ()
    memory_used: int = 0
    history_turns: int = 0


# --- AI Guide ----------------------------------------------------------


class AiChatRequest(BaseModel):
    """One grounded question about one calculated chart.

    Anonymous visitors get a single stateless turn. A logged-in user (send
    the bearer token) also gets saved conversations, follow-up questions that
    see the earlier turns, their saved explanation depth and configuration,
    and the memories they chose to keep.
    """

    birth: BirthData
    system: Literal["vedic", "western", "compare"] = "vedic"
    question: str = Field(min_length=1, max_length=2000)
    config: CalculationConfig | None = None
    depth: ExplanationDepth | None = None
    """How technical to be. Falls back to the user's saved preference, then
    to `beginner`."""
    conversation_id: int | None = Field(default=None, ge=1)
    """Continue a saved conversation (logged-in users only). Omit to start a
    new one - a logged-in user's answered questions are saved; an anonymous
    visitor's never are."""

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "summary": "Ask about the Vedic chart",
                    "value": {
                        "birth": {
                            "birth_date": "1990-08-15",
                            "birth_time": "14:30:00",
                            "time_confidence": "EXACT",
                            "latitude": 18.9756,
                            "longitude": 72.8258,
                            "timezone_name": "Asia/Kolkata",
                        },
                        "system": "vedic",
                        "question": "What does my Moon's nakshatra suggest "
                        "about my emotional temperament?",
                    },
                },
            ]
        }
    }


class AiChatResponse(BaseModel):
    """The AI's answer, plus enough to reproduce how it was grounded."""

    answer: str
    system_used: Literal["vedic", "western", "compare"]

    model: str | None
    """The model that wrote the answer, or None when no model was involved:
    a crisis and an off-topic request are answered with fixed text."""

    intent: Intent
    """What the question was classified as (engineering spec §14)."""

    notice: str | None = None
    """Authored text a client must show alongside the answer, set for
    high-stakes questions (product spec §22). Deliberately separate from
    `answer`: it is not the AI's words and must not depend on them, so a
    client that hides it is hiding a safety message, not an explanation."""

    safety_flags: list[str] = []
    """Why the answer is not what the model first said - `certainty_claim`
    or `risky_directive` when the output backstop replaced it, `crisis` when
    the question was answered without the model. Empty for an ordinary
    answer."""

    depth: ExplanationDepth
    """The explanation depth that was used."""

    conversation_id: int | None = None
    """The saved conversation this exchange belongs to, so the next question
    can continue it. `null` for an anonymous visitor, and for an answer that
    never reached the model (a crisis or off-topic request), which is not
    saved."""

    factors: AnswerFactorsResponse = AnswerFactorsResponse()
    """What the answer was built from (product spec §23)."""


# --- Readings ------------------------------------------------------------


class ReadingRequest(BaseModel):
    """A daily, weekly, or monthly reading (product spec §13), grounded in
    today's transits against the natal chart - all three periods share this
    request shape; only which endpoint you call differs. Vedic only for
    now - the Compare/Western equivalents are a later reading category, not
    this one."""

    birth: BirthData
    config: CalculationConfig | None = None
    depth: ExplanationDepth | None = None
    """How technical to be; see `AiChatRequest.depth`."""
    topic: ReadingTopic | None = None
    """Optional life-area focus for a daily, weekly or monthly reading.
    `birth_chart` is not a focus - it is its own reading, at
    `/readings/topic/birth_chart` - and is rejected here."""

    @field_validator("topic")
    @classmethod
    def _topic_is_a_focus(cls, value: ReadingTopic | None) -> ReadingTopic | None:
        if value is ReadingTopic.BIRTH_CHART:
            raise ValueError(
                "birth_chart is not a topic focus; use /readings/topic/birth_chart"
            )
        return value

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "value": {
                        "birth": {
                            "birth_date": "1990-08-15",
                            "birth_time": "14:30:00",
                            "time_confidence": "EXACT",
                            "latitude": 18.9756,
                            "longitude": 72.8258,
                            "timezone_name": "Asia/Kolkata",
                        },
                    },
                },
            ]
        }
    }


class TopicReadingRequest(BaseModel):
    """A category reading; the category is in the path."""

    birth: BirthData
    config: CalculationConfig | None = None
    depth: ExplanationDepth | None = None


class ReadingResponse(BaseModel):
    reading: str
    model: str
    generated_for: datetime | None
    """The UTC moment the transits were calculated for - the same quantised
    "now" `/transits` itself would report, so the reading can be shown
    alongside its grounding data without a mismatched timestamp. `null` for
    a birth-chart reading, which uses no transits."""
    safety_flags: list[str] = []
    """`certainty_claim` or `risky_directive` if the output backstop had to
    replace what the model wrote with a fixed fallback; empty otherwise."""
    depth: ExplanationDepth
    factors: AnswerFactorsResponse = AnswerFactorsResponse()
    """What the reading was built from (product spec §23)."""


# --- Preferences -------------------------------------------------------------


class PreferencesRequest(BaseModel):
    """Replaces the user's saved preferences."""

    explanation_depth: ExplanationDepth = ExplanationDepth.BEGINNER
    calculation_config: CalculationConfig | None = None
    """`null` returns to the application default."""

    @field_validator("calculation_config")
    @classmethod
    def _no_server_paths(cls, value: CalculationConfig | None) -> CalculationConfig | None:
        # `ephemeris_path` points at a directory on the server. It is a
        # deployment setting, not something a user should be able to store.
        if value is not None and value.ephemeris_path is not None:
            raise ValueError("ephemeris_path is a server setting and cannot be saved")
        return value


class PreferencesResponse(BaseModel):
    explanation_depth: ExplanationDepth
    calculation_config: CalculationConfig | None


# --- Memory --------------------------------------------------------------------


class MemoryRequest(BaseModel):
    """Something the user wants the guide to remember. Only ever created by
    an explicit request - nothing becomes a memory on its own."""

    kind: Literal["preference", "note"]
    content: str = Field(min_length=1, max_length=500)


class MemoryResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    kind: Literal["preference", "note"]
    content: str
    created_at: datetime


class MemoryListResponse(BaseModel):
    memories: tuple[MemoryResponse, ...]


# --- Conversations ---------------------------------------------------------------


class ConversationSummaryResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    title: str
    created_at: datetime
    updated_at: datetime


class ConversationListResponse(BaseModel):
    conversations: tuple[ConversationSummaryResponse, ...]


class ConversationMessageResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


class ConversationDetailResponse(ConversationSummaryResponse):
    messages: tuple[ConversationMessageResponse, ...]


# --- Planet exploration ------------------------------------------------------------


class PlanetExplorationRequest(BaseModel):
    birth: BirthData
    system: Literal["vedic", "western"] = "vedic"
    body: str = Field(min_length=1, max_length=20, examples=["Saturn"])
    """The planet or graha's name, in any case."""
    config: CalculationConfig | None = None


class PlanetAboutResponse(BaseModel):
    """The curated description of a planet (from the versioned knowledge
    base): the traditional view, not a calculation."""

    model_config = {"from_attributes": True}

    id: str
    title: str
    version: int
    text: str


class PlanetExplorationResponse(BaseModel):
    """Everything known about one planet in one chart."""

    system: Literal["vedic", "western"]
    body: str

    placement: GrahaPlacement | None = None
    """Vedic: the graha's place in the D1 chart."""
    transit: GrahaTransit | None = None
    """Vedic: where the graha is now, against the natal chart."""

    position: PlanetPosition | None = None
    """Western: the planet's place in the tropical chart."""
    aspects: tuple[Aspect, ...] = ()
    """Western: every aspect this planet makes."""

    about: PlanetAboutResponse | None = None
