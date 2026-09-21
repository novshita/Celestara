"""Birth data validation, timezone resolution and DST edge cases.

Engineering spec §31 lists timezone and DST handling as top-priority test
coverage, because a one-hour error moves the Ascendant by roughly 15 degrees -
half a rashi.
"""

from __future__ import annotations

from datetime import date, time

import pytest
import swisseph as swe
from pydantic import ValidationError

from app.domain.birth_data import (
    ASSUMED_UNKNOWN_TIME,
    BirthData,
    BirthTimeConfidence,
    DstAnomaly,
    resolve_birth_moment,
    resolve_timezone,
)

from .conftest import MUMBAI_LAT, MUMBAI_LON


def _resolve(birth: BirthData):
    return resolve_birth_moment(birth, julian_day=swe.julday)


# --- Validation -----------------------------------------------------------


def test_exact_confidence_requires_a_time():
    with pytest.raises(ValidationError, match="birth_time is required"):
        BirthData(
            birth_date=date(1990, 8, 15),
            birth_time=None,
            time_confidence=BirthTimeConfidence.EXACT,
            latitude=MUMBAI_LAT,
            longitude=MUMBAI_LON,
        )


def test_unknown_confidence_rejects_a_time():
    """A time you have but distrust is ESTIMATED, not UNKNOWN."""
    with pytest.raises(ValidationError, match="must be omitted"):
        BirthData(
            birth_date=date(1990, 8, 15),
            birth_time=time(14, 30),
            time_confidence=BirthTimeConfidence.UNKNOWN,
            latitude=MUMBAI_LAT,
            longitude=MUMBAI_LON,
        )


@pytest.mark.parametrize(
    ("lat", "lon"),
    [(91.0, 0.0), (-91.0, 0.0), (0.0, 181.0), (0.0, -181.0)],
)
def test_coordinates_are_range_checked(lat, lon):
    with pytest.raises(ValidationError):
        BirthData(
            birth_date=date(1990, 8, 15),
            birth_time=time(14, 30),
            latitude=lat,
            longitude=lon,
        )


# --- Timezone resolution --------------------------------------------------


def test_timezone_is_derived_from_coordinates():
    birth = BirthData(
        birth_date=date(1990, 8, 15),
        birth_time=time(14, 30),
        latitude=MUMBAI_LAT,
        longitude=MUMBAI_LON,
    )

    assert resolve_timezone(birth) == "Asia/Kolkata"


def test_explicit_timezone_overrides_coordinates():
    """The user's manual correction wins (product spec §8)."""
    birth = BirthData(
        birth_date=date(1990, 8, 15),
        birth_time=time(14, 30),
        latitude=MUMBAI_LAT,
        longitude=MUMBAI_LON,
        timezone_name="Asia/Dubai",
    )

    assert resolve_timezone(birth) == "Asia/Dubai"


def test_unknown_timezone_name_is_rejected():
    birth = BirthData(
        birth_date=date(1990, 8, 15),
        birth_time=time(14, 30),
        latitude=MUMBAI_LAT,
        longitude=MUMBAI_LON,
        timezone_name="Mars/Olympus_Mons",
    )

    with pytest.raises(ValueError, match="unknown timezone"):
        resolve_timezone(birth)


def test_mid_ocean_coordinates_resolve_to_a_nautical_zone():
    """timezonefinder covers open ocean with `Etc/GMT` offset zones.

    Worth pinning: it means resolution effectively never fails, so the
    "no timezone found" path in `resolve_timezone` is defensive rather than
    routine. A user born at sea gets the nautical offset for their longitude,
    which is the correct default and still manually correctable.
    """
    birth = BirthData(
        birth_date=date(1990, 8, 15),
        birth_time=time(14, 30),
        latitude=0.0,
        longitude=-150.0,
    )

    assert resolve_timezone(birth) == "Etc/GMT+10"


# --- UTC conversion -------------------------------------------------------


def test_ist_offset_is_applied(reference_birth):
    """14:30 IST is 09:00 UTC; IST is +5:30, a half-hour offset."""
    moment = _resolve(reference_birth)

    assert moment.utc_offset_hours == pytest.approx(5.5)
    assert moment.utc_datetime.hour == 9
    assert moment.utc_datetime.minute == 0
    assert moment.julian_day_ut == pytest.approx(2448118.875, abs=1e-9)


def test_exact_time_has_no_uncertainty_or_assumptions(reference_birth):
    moment = _resolve(reference_birth)

    assert moment.uncertainty_hours == 0.0
    assert moment.assumptions == ()
    assert moment.dst_anomaly is DstAnomaly.NONE
    assert moment.has_usable_time


# --- DST edge cases -------------------------------------------------------


def test_ambiguous_time_is_flagged_not_silently_resolved():
    """01:30 on 2023-11-05 in New York happened twice: EDT then EST."""
    birth = BirthData(
        birth_date=date(2023, 11, 5),
        birth_time=time(1, 30),
        latitude=40.7128,
        longitude=-74.0060,
        timezone_name="America/New_York",
    )

    moment = _resolve(birth)

    assert moment.dst_anomaly is DstAnomaly.AMBIGUOUS
    assert moment.utc_offset_hours == pytest.approx(-4.0)  # earlier, EDT
    assert any("occurred twice" in note for note in moment.assumptions)


def test_nonexistent_time_is_flagged():
    """02:30 on 2023-03-12 in New York never happened: clocks skipped it."""
    birth = BirthData(
        birth_date=date(2023, 3, 12),
        birth_time=time(2, 30),
        latitude=40.7128,
        longitude=-74.0060,
        timezone_name="America/New_York",
    )

    moment = _resolve(birth)

    assert moment.dst_anomaly is DstAnomaly.NONEXISTENT
    assert any("did not occur" in note for note in moment.assumptions)


def test_time_outside_a_transition_is_clean():
    birth = BirthData(
        birth_date=date(2023, 6, 15),
        birth_time=time(1, 30),
        latitude=40.7128,
        longitude=-74.0060,
        timezone_name="America/New_York",
    )

    assert _resolve(birth).dst_anomaly is DstAnomaly.NONE


def test_wartime_india_offset_is_honoured():
    """India ran on +6:30 during the war, not +5:30.

    "Indian War Time" applied from 1942 to late 1945. Assuming the modern
    +5:30 for a birth in that window puts the chart an hour out - roughly
    15 degrees of Ascendant, half a rashi. This asserts the offset comes from
    zoneinfo's history rather than a hardcoded constant.
    """
    wartime = BirthData(
        birth_date=date(1945, 3, 10),
        birth_time=time(6, 0),
        latitude=MUMBAI_LAT,
        longitude=MUMBAI_LON,
        timezone_name="Asia/Kolkata",
    )
    post_war = wartime.model_copy(update={"birth_date": date(1946, 3, 10)})

    assert _resolve(wartime).utc_offset_hours == pytest.approx(6.5)
    assert _resolve(post_war).utc_offset_hours == pytest.approx(5.5)


# --- Unknown birth time ---------------------------------------------------


def test_unknown_time_states_its_assumption(unknown_time_birth):
    """Spec §8: never invent a time without identifying it as an assumption."""
    moment = _resolve(unknown_time_birth)

    assert not moment.has_usable_time
    assert moment.uncertainty_hours == 12.0
    assert moment.assumptions, "an invented time must always be declared"
    assert any("unknown" in note.lower() for note in moment.assumptions)
    assert any(
        ASSUMED_UNKNOWN_TIME.strftime("%H:%M") in note
        for note in moment.assumptions
    )


def test_unknown_time_anchors_at_local_noon(unknown_time_birth):
    """12:00 IST is 06:30 UTC."""
    moment = _resolve(unknown_time_birth)

    assert moment.utc_datetime.hour == 6
    assert moment.utc_datetime.minute == 30


def test_unknown_time_window_spans_the_whole_day(unknown_time_birth):
    moment = _resolve(unknown_time_birth)
    low, high = moment.window_bounds_jd()

    assert high - low == pytest.approx(1.0, abs=1e-9)


def test_estimated_time_carries_a_narrower_window():
    birth = BirthData(
        birth_date=date(1990, 8, 15),
        birth_time=time(14, 30),
        time_confidence=BirthTimeConfidence.ESTIMATED,
        latitude=MUMBAI_LAT,
        longitude=MUMBAI_LON,
        timezone_name="Asia/Kolkata",
    )

    moment = _resolve(birth)

    assert moment.has_usable_time  # houses are indicative, not withheld
    assert moment.uncertainty_hours == pytest.approx(1.0)
    assert any("estimated" in note.lower() for note in moment.assumptions)
