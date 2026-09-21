"""Reference-chart fixture model and comparison logic.

Separated from the tests that use it so the comparison logic can itself be
tested. A validation harness that cannot be shown to detect errors provides
false confidence rather than assurance, so `test_reference_harness.py`
exercises every function here against deliberately wrong data.
"""

from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, Field, field_validator

from app.domain.birth_data import BirthData
from app.domain.vedic import VedicChart
from app.services.astrology.common.constants import (
    DEGREES_PER_PADA,
    DEGREES_PER_RASHI,
    RASHI_WESTERN_NAMES,
    RASHIS,
)

#: Default agreement threshold. Independent implementations of Lahiri can
#: legitimately differ by a few arcseconds - notably over whether nutation is
#: included, which is ~14" - and transcribing from a screen usually loses the
#: seconds column. Two arcminutes absorbs both while remaining thousands of
#: times tighter than any error that matters: a wrong ayanamsa is degrees off,
#: a wrong house frame is 30 degrees off.
DEFAULT_TOLERANCE_ARCMIN = 2.0


def rashi_index_from_name(name: str) -> int:
    """Resolve a sign name, accepting either Sanskrit or Western spelling."""
    cleaned = name.strip().lower()
    for index, (vedic, western) in enumerate(zip(RASHIS, RASHI_WESTERN_NAMES)):
        if cleaned in (vedic.lower(), western.lower()):
            return index
    raise ValueError(
        f"unknown rashi {name!r}; expected one of {RASHIS} or "
        f"{RASHI_WESTERN_NAMES}"
    )


def angular_difference(first: float, second: float) -> float:
    """Shortest angular distance in degrees, handling the 0/360 wrap."""
    delta = abs((first - second) % 360.0)
    return min(delta, 360.0 - delta)


def describe_longitude(longitude: float) -> str:
    """Render a longitude the way astrology software displays it."""
    index = int(longitude % 360.0 // DEGREES_PER_RASHI)
    within = longitude % DEGREES_PER_RASHI
    degrees = int(within)
    minutes_full = (within - degrees) * 60.0
    minutes = int(minutes_full)
    seconds = (minutes_full - minutes) * 60.0
    return (
        f"{RASHIS[index]} {degrees}°{minutes:02d}'{seconds:05.2f}\" "
        f"({longitude:.4f})"
    )


class ReferencePosition(BaseModel):
    """One expected position, as displayed by the source software."""

    model_config = {"frozen": True}

    rashi: str
    deg: int = Field(ge=0, le=29)
    min: int = Field(default=0, ge=0, le=59)
    sec: float = Field(default=0.0, ge=0.0, lt=60.0)

    retrograde: bool | None = None
    nakshatra: str | None = None
    pada: int | None = Field(default=None, ge=1, le=4)

    @field_validator("rashi")
    @classmethod
    def _rashi_must_be_known(cls, value: str) -> str:
        rashi_index_from_name(value)  # raises if unrecognised
        return value

    @property
    def longitude(self) -> float:
        """Absolute sidereal longitude implied by sign plus degrees."""
        within = self.deg + self.min / 60.0 + self.sec / 3600.0
        return rashi_index_from_name(self.rashi) * DEGREES_PER_RASHI + within

    def __str__(self) -> str:
        return (
            f"{self.rashi} {self.deg}°{self.min:02d}'{self.sec:05.2f}\" "
            f"({self.longitude:.4f})"
        )


class ReferenceGraha(ReferencePosition):
    graha: str


class ReferenceChart(BaseModel):
    """A chart transcribed from independent software."""

    model_config = {"frozen": True}

    source: str
    """Which software produced this, including version. A reference with no
    provenance is not a reference."""

    notes: str | None = None
    tolerance_arcmin: float = Field(default=DEFAULT_TOLERANCE_ARCMIN, gt=0.0)

    birth: BirthData
    ascendant: ReferencePosition | None = None
    placements: tuple[ReferenceGraha, ...] = ()

    @field_validator("source")
    @classmethod
    def _source_must_be_meaningful(cls, value: str) -> str:
        if len(value.strip()) < 4 or "REPLACE ME" in value:
            raise ValueError(
                "source must name the software that produced this chart"
            )
        return value

    @property
    def tolerance_degrees(self) -> float:
        return self.tolerance_arcmin / 60.0

    def verifies_something(self) -> bool:
        return bool(self.ascendant or self.placements)


# --- Comparisons ----------------------------------------------------------
#
# Each returns a list of human-readable failures, empty when everything agrees.
# Returning rather than asserting keeps them usable from the meta-tests.


def compare_ascendant(chart: VedicChart, reference: ReferenceChart) -> list[str]:
    """Compare the Lagna longitude.

    The most sensitive value in the chart: it depends on time, place, ayanamsa
    and frame all being right, so it fails first if any of them is wrong.
    """
    if reference.ascendant is None:
        return []

    if chart.ascendant is None:
        return ["we produced no ascendant, but the reference records one"]

    ours = chart.ascendant.longitude
    theirs = reference.ascendant.longitude
    difference = angular_difference(ours, theirs)

    if difference <= reference.tolerance_degrees:
        return []

    return [
        f"Ascendant disagrees with {reference.source}\n"
        f"  expected: {reference.ascendant}\n"
        f"  ours:     {describe_longitude(ours)}\n"
        f"  off by:   {difference * 60:.2f} arcmin "
        f"(tolerance {reference.tolerance_arcmin} arcmin)"
    ]


def compare_ascendant_rashi(
    chart: VedicChart, reference: ReferenceChart
) -> list[str]:
    """A sign mismatch is never a rounding artefact.

    Signs are 30 degrees wide, so this failing means something structural is
    wrong - most likely the sidereal frame or the ayanamsa.
    """
    if reference.ascendant is None or chart.ascendant is None:
        return []

    expected = rashi_index_from_name(reference.ascendant.rashi)
    if chart.ascendant.rashi_index == expected:
        return []

    return [
        f"Ascendant in the wrong rashi per {reference.source}: expected "
        f"{reference.ascendant.rashi}, got {chart.ascendant.rashi}"
    ]


def compare_longitudes(chart: VedicChart, reference: ReferenceChart) -> list[str]:
    """Compare every recorded graha longitude.

    All mismatches are collected rather than failing on the first, so a
    systematic offset - every body wrong by the same amount, the signature of
    an ayanamsa problem - is visible at a glance.
    """
    failures: list[str] = []

    for expected in reference.placements:
        ours = chart.placement(expected.graha).longitude
        difference = angular_difference(ours, expected.longitude)

        if difference > reference.tolerance_degrees:
            failures.append(
                f"  {expected.graha:8s} expected {expected}  "
                f"ours {describe_longitude(ours)}  "
                f"off by {difference * 60:.2f}'"
            )

    return failures


def compare_rashis(chart: VedicChart, reference: ReferenceChart) -> list[str]:
    return [
        f"  {expected.graha}: expected {expected.rashi}, "
        f"got {chart.placement(expected.graha).rashi}"
        for expected in reference.placements
        if chart.placement(expected.graha).rashi_index
        != rashi_index_from_name(expected.rashi)
    ]


def compare_nakshatras(chart: VedicChart, reference: ReferenceChart) -> list[str]:
    failures: list[str] = []

    for expected in reference.placements:
        if not expected.nakshatra:
            continue
        ours = chart.placement(expected.graha).nakshatra
        if ours.name.strip().lower() != expected.nakshatra.strip().lower():
            failures.append(
                f"  {expected.graha}: expected {expected.nakshatra}, "
                f"got {ours.name}"
            )

    return failures


def compare_padas(chart: VedicChart, reference: ReferenceChart) -> list[str]:
    """Padas are 3°20' wide, the tightest check available.

    Distance to the nearest boundary is reported, because a pada mismatch on a
    body that is otherwise within tolerance usually means it sits on a
    boundary rather than that anything is broken.
    """
    failures: list[str] = []

    for expected in reference.placements:
        if expected.pada is None:
            continue

        placement = chart.placement(expected.graha)
        if placement.nakshatra.pada == expected.pada:
            continue

        offset = placement.longitude % DEGREES_PER_PADA
        boundary_distance = min(offset, DEGREES_PER_PADA - offset)
        failures.append(
            f"  {expected.graha}: expected pada {expected.pada}, got "
            f"{placement.nakshatra.pada} "
            f"({boundary_distance * 60:.2f}' from the nearest pada boundary)"
        )

    return failures


def compare_retrogrades(chart: VedicChart, reference: ReferenceChart) -> list[str]:
    def label(value: bool) -> str:
        return "retrograde" if value else "direct"

    return [
        f"  {expected.graha}: expected {label(expected.retrograde)}, "
        f"got {label(chart.placement(expected.graha).retrograde)}"
        for expected in reference.placements
        if expected.retrograde is not None
        and chart.placement(expected.graha).retrograde != expected.retrograde
    ]


# --- Loading --------------------------------------------------------------


def load_reference(path: Path) -> ReferenceChart:
    return ReferenceChart.model_validate(json.loads(path.read_text()))


def discover_references(directory: Path) -> list[Path]:
    """Fixture files in `directory`.

    Names beginning with `_` are templates and documentation, not data.
    """
    return sorted(
        path
        for path in directory.glob("*.json")
        if not path.name.startswith("_")
    )
