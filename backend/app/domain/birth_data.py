"""Birth data and the resolution of it into a calculable instant.

Product spec §8 and engineering spec §9: an unknown birth time is a supported
first-class state, not an error and not something to paper over with a default.
Everything time-dependent downstream reads `confidence` and refuses to invent
what it does not know.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, datetime, time, timedelta, timezone
from enum import Enum
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, model_validator


class BirthTimeConfidence(str, Enum):
    """How much the birth time can be trusted.

    Carried through the whole calculation pipeline so the frontend and the AI
    both receive the limitation rather than inferring it.
    """

    EXACT = "EXACT"
    """Known to the minute, e.g. from a birth certificate."""

    ESTIMATED = "ESTIMATED"
    """Approximate - "sometime around 3pm". Houses are indicative only."""

    UNKNOWN = "UNKNOWN"
    """Not known at all. Time-dependent factors are unavailable."""


class DstAnomaly(str, Enum):
    """Whether the local wall-clock time is well defined.

    A birth time can be genuinely unrepresentable: clocks skip forward, and
    they also repeat an hour. Both are silently "resolved" by most datetime
    libraries, which is how a chart ends up an hour wrong with no indication.
    """

    NONE = "NONE"

    AMBIGUOUS = "AMBIGUOUS"
    """The wall-clock time occurred twice (DST ended). Two valid UTC instants
    exist; the earlier is used and the user should confirm."""

    NONEXISTENT = "NONEXISTENT"
    """The wall-clock time never occurred (DST began). The recorded time is
    inside the skipped hour, so the record itself is suspect."""


#: Assumed local time when the birth time is unknown. Midday minimises the
#: worst-case error in the fast-moving Moon across the day, and is recorded as
#: an explicit assumption rather than presented as data.
ASSUMED_UNKNOWN_TIME = time(12, 0)

#: Default uncertainty either side of an ESTIMATED time.
ESTIMATED_WINDOW = timedelta(hours=1)


class BirthData(BaseModel):
    """Raw birth information as supplied by the user."""

    model_config = {"frozen": True}

    birth_date: date

    birth_time: time | None = None
    """Omitted when `time_confidence` is UNKNOWN."""

    time_confidence: BirthTimeConfidence = BirthTimeConfidence.EXACT

    latitude: float = Field(ge=-90.0, le=90.0)
    longitude: float = Field(ge=-180.0, le=180.0)

    timezone_name: str | None = None
    """IANA zone. Resolved from coordinates when omitted; an explicit value is
    the user's manual correction and always wins (product spec §8)."""

    @model_validator(mode="after")
    def _check_time_against_confidence(self) -> BirthData:
        if self.time_confidence is BirthTimeConfidence.UNKNOWN:
            if self.birth_time is not None:
                raise ValueError(
                    "birth_time must be omitted when time_confidence is UNKNOWN; "
                    "a known time with low trust is ESTIMATED"
                )
        elif self.birth_time is None:
            raise ValueError(
                f"birth_time is required when time_confidence is "
                f"{self.time_confidence.value}"
            )
        return self


class ResolvedBirthMoment(BaseModel):
    """A birth moment converted to something the ephemeris can consume."""

    model_config = {"frozen": True}

    utc_datetime: datetime
    julian_day_ut: float

    timezone_name: str
    utc_offset_hours: float

    time_confidence: BirthTimeConfidence
    dst_anomaly: DstAnomaly = DstAnomaly.NONE

    uncertainty_hours: float = 0.0
    """Half-width of the window the true instant lies within. Zero for EXACT."""

    assumptions: tuple[str, ...] = ()
    """Human-readable assumptions applied. Never empty when a time was
    invented, so the UI and the AI can both state them plainly."""

    @property
    def has_usable_time(self) -> bool:
        """Whether time-dependent factors (Ascendant, bhavas) may be computed."""
        return self.time_confidence is not BirthTimeConfidence.UNKNOWN

    def window_bounds_jd(self, day_fraction_per_hour: float = 1 / 24) -> tuple[float, float]:
        """Julian Day bounds of the uncertainty window."""
        delta = self.uncertainty_hours * day_fraction_per_hour
        return (self.julian_day_ut - delta, self.julian_day_ut + delta)


def resolve_timezone(birth: BirthData) -> str:
    """Determine the IANA zone for a birth record.

    An explicit `timezone_name` is trusted as the user's correction. Otherwise
    it is looked up from the coordinates.
    """
    if birth.timezone_name:
        try:
            ZoneInfo(birth.timezone_name)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError(
                f"unknown timezone {birth.timezone_name!r}"
            ) from exc
        return birth.timezone_name

    # Imported lazily: loading the timezone polygon data is expensive and
    # unnecessary whenever the caller supplied a zone.
    from timezonefinder import TimezoneFinder

    finder = TimezoneFinder()
    found = finder.timezone_at(lat=birth.latitude, lng=birth.longitude)
    if found is None:
        raise ValueError(
            f"could not determine a timezone for {birth.latitude}, "
            f"{birth.longitude}; the coordinates may be mid-ocean. Ask the "
            f"user to supply one."
        )
    return found


def _classify_dst(naive_local: datetime, zone: ZoneInfo) -> DstAnomaly:
    """Detect whether a wall-clock time is ambiguous or never happened."""
    first = naive_local.replace(tzinfo=zone, fold=0)
    second = naive_local.replace(tzinfo=zone, fold=1)

    if first.utcoffset() != second.utcoffset():
        # The same wall clock maps to two different offsets. Which of the two
        # cases it is depends on whether round-tripping preserves the clock.
        round_tripped = first.astimezone(timezone.utc).astimezone(zone)
        if round_tripped.replace(tzinfo=None) != naive_local:
            return DstAnomaly.NONEXISTENT
        return DstAnomaly.AMBIGUOUS

    return DstAnomaly.NONE


def resolve_birth_moment(
    birth: BirthData,
    *,
    julian_day: Callable[[int, int, int, float], float],
) -> ResolvedBirthMoment:
    """Convert birth data into a Julian Day plus its caveats.

    `julian_day` is the engine's conversion function, injected so this module
    stays free of any ephemeris dependency.
    """
    zone_name = resolve_timezone(birth)
    zone = ZoneInfo(zone_name)

    assumptions: list[str] = []
    uncertainty_hours = 0.0

    if birth.time_confidence is BirthTimeConfidence.UNKNOWN:
        local_time = ASSUMED_UNKNOWN_TIME
        uncertainty_hours = 12.0
        assumptions.append(
            f"Birth time is unknown. Positions are calculated for "
            f"{ASSUMED_UNKNOWN_TIME.strftime('%H:%M')} local time as a stated "
            f"assumption, not as recorded data. The true time lies anywhere in "
            f"the 24 hours of this date."
        )
    else:
        assert birth.birth_time is not None  # guaranteed by the validator
        local_time = birth.birth_time
        if birth.time_confidence is BirthTimeConfidence.ESTIMATED:
            uncertainty_hours = ESTIMATED_WINDOW.total_seconds() / 3600.0
            assumptions.append(
                f"Birth time is estimated, treated as accurate to within "
                f"±{uncertainty_hours:g} hour(s)."
            )

    naive_local = datetime.combine(birth.birth_date, local_time)
    anomaly = _classify_dst(naive_local, zone)

    if anomaly is DstAnomaly.AMBIGUOUS:
        assumptions.append(
            "This local time occurred twice on this date because daylight "
            "saving time ended. The first (pre-transition) occurrence is used; "
            "the user should confirm which applies."
        )
    elif anomaly is DstAnomaly.NONEXISTENT:
        assumptions.append(
            "This local time did not occur on this date because clocks moved "
            "forward. The recorded time is likely mis-transcribed; it has been "
            "interpreted using the pre-transition offset."
        )

    # fold=0 selects the earlier of two candidate instants, which is also the
    # pre-transition offset for a skipped hour.
    local_dt = naive_local.replace(tzinfo=zone, fold=0)
    utc_dt = local_dt.astimezone(timezone.utc)

    offset = local_dt.utcoffset()
    assert offset is not None

    hour_fraction = (
        utc_dt.hour
        + utc_dt.minute / 60.0
        + (utc_dt.second + utc_dt.microsecond / 1_000_000) / 3600.0
    )
    jd = julian_day(utc_dt.year, utc_dt.month, utc_dt.day, hour_fraction)

    return ResolvedBirthMoment(
        utc_datetime=utc_dt,
        julian_day_ut=jd,
        timezone_name=zone_name,
        utc_offset_hours=offset.total_seconds() / 3600.0,
        time_confidence=birth.time_confidence,
        dst_anomaly=anomaly,
        uncertainty_hours=uncertainty_hours,
        assumptions=tuple(assumptions),
    )
