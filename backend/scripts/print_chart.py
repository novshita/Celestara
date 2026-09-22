#!/usr/bin/env python
"""Print a chart for eyeball comparison against other astrology software.

    python scripts/print_chart.py --date 1990-08-15 --time 14:30 \
        --lat 18.9756 --lon 72.8258 --tz Asia/Kolkata

Add `--skeleton` to also emit a reference-fixture stub with the birth details
filled in and the expected values left blank, ready to complete from the other
tool's output.

The stub is deliberately *not* pre-filled with our own numbers: a fixture
populated from our engine would pass by construction and verify nothing. See
tests/reference_charts/README.md.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.domain.birth_data import BirthData, BirthTimeConfidence  # noqa: E402
from app.domain.vedic import VedicChart  # noqa: E402
from app.services.astrology.common.constants import (  # noqa: E402
    DEGREES_PER_RASHI,
    NAVAGRAHA,
)
from app.services.astrology.vedic.d1 import calculate_d1_chart  # noqa: E402


def _dms(longitude: float) -> str:
    """Degrees within the sign, as `dd°mm'ss.ss"` - how software displays it."""
    within = longitude % DEGREES_PER_RASHI
    degrees = int(within)
    minutes_full = (within - degrees) * 60.0
    minutes = int(minutes_full)
    seconds = (minutes_full - minutes) * 60.0
    return f"{degrees:2d}°{minutes:02d}'{seconds:05.2f}\""


def _print_chart(chart: VedicChart) -> None:
    print("=" * 74)
    print("OUR OUTPUT  (for comparison only - do not copy into a fixture)")
    print("=" * 74)

    moment = chart.metadata.moment
    print(f"  UTC            : {moment.utc_datetime:%Y-%m-%d %H:%M:%S}")
    print(f"  timezone       : {moment.timezone_name} "
          f"(UTC{moment.utc_offset_hours:+g})")
    print(f"  ayanamsa       : {chart.metadata.ayanamsa_degrees:.6f}°")
    print(f"  engine         : {chart.metadata.engine_id}")
    print(f"  time confidence: {moment.time_confidence.value}")

    if moment.dst_anomaly.value != "NONE":
        print(f"  DST ANOMALY    : {moment.dst_anomaly.value}")
    for note in moment.assumptions:
        print(f"  assumption     : {note}")

    print()
    if chart.ascendant is None:
        print("  Ascendant      : UNAVAILABLE (birth time unknown)")
    else:
        print(f"  Ascendant      : {chart.ascendant.rashi:12s} "
              f"{_dms(chart.ascendant.longitude)}  "
              f"[{chart.ascendant.nakshatra.name}]")

    print()
    print(f"  {'GRAHA':8s} {'RASHI':12s} {'DEGREES':>14s} {'BH':>3s} "
          f"{'NAKSHATRA':18s} {'PD':>2s}  R  CERTAIN")
    print(f"  {'-' * 8} {'-' * 12} {'-' * 14} {'-' * 3} {'-' * 18} {'-' * 2}  -  -------")

    for placement in chart.placements:
        certain = "" if placement.certainty.fully_certain else "UNCERTAIN"
        print(
            f"  {placement.graha:8s} {placement.rashi:12s} "
            f"{_dms(placement.longitude):>14s} "
            f"{placement.bhava if placement.bhava else '-':>3} "
            f"{placement.nakshatra.name:18s} {placement.nakshatra.pada:2d}  "
            f"{'R' if placement.retrograde else ' '}  {certain}"
        )

    if chart.metadata.unavailable:
        print()
        print(f"  unavailable    : {', '.join(chart.metadata.unavailable)}")


def _print_dasha(birth: BirthData) -> None:
    """Print the Vimshottari timeline, marking the period active today."""
    from datetime import datetime, timezone

    from app.services.astrology.vedic.dasha import (
        DashaUnavailableError,
        calculate_vimshottari,
    )

    print()
    print("=" * 74)
    print("VIMSHOTTARI DASHA")
    print("=" * 74)

    try:
        timeline = calculate_vimshottari(birth)
    except DashaUnavailableError as exc:
        print(f"  UNAVAILABLE: {exc}")
        return

    now = datetime.now(timezone.utc)
    active = {id(period) for period in timeline.active_at(now)}

    print(f"  seeded from    : Moon in {timeline.moon_nakshatra.name} "
          f"pada {timeline.moon_nakshatra.pada}")
    print(f"  starting lord  : {timeline.starting_lord} "
          f"({timeline.elapsed_fraction:.1%} of its period already elapsed)")
    print(f"  balance at birth: {timeline.balance_years:.4f} years")
    print(f"  year length    : {timeline.year_length.value} "
          f"({timeline.year_days} days)")
    if timeline.uncertainty_days:
        print(f"  DATE UNCERTAINTY: ±{timeline.uncertainty_days:.0f} days, from "
              f"the birth-time uncertainty")
    print()

    for period in timeline.periods:
        marker = " <- now" if id(period) in active else ""
        partial = " (partial)" if period.is_partial else ""
        print(f"  {period.lord:8s} {period.start:%Y-%m-%d} -> "
              f"{period.end:%Y-%m-%d}  {period.duration_years:7.3f}y"
              f"{partial}{marker}")

        for sub in period.sub_periods:
            if id(sub) in active:
                print(f"      └─ {sub.lord:8s} {sub.start:%Y-%m-%d} -> "
                      f"{sub.end:%Y-%m-%d}  {sub.duration_years:6.3f}y  <- now")


def _print_skeleton(birth: BirthData) -> None:
    """Emit a fixture stub: inputs filled, expected values blank."""
    skeleton = {
        "source": "REPLACE ME - software name and version",
        "notes": "",
        "tolerance_arcmin": 2,
        "birth": json.loads(birth.model_dump_json(exclude_none=True)),
        "ascendant": {"rashi": "", "deg": 0, "min": 0},
        "placements": [
            {"graha": graha, "rashi": "", "deg": 0, "min": 0}
            for graha in NAVAGRAHA
        ],
    }

    print()
    print("=" * 74)
    print("FIXTURE SKELETON  (fill from the OTHER software, not from above)")
    print("=" * 74)
    print(json.dumps(skeleton, indent=2))


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--date", required=True, help="birth date, YYYY-MM-DD")
    parser.add_argument("--time", help="birth time, HH:MM (omit with --unknown-time)")
    parser.add_argument("--lat", required=True, type=float)
    parser.add_argument("--lon", required=True, type=float)
    parser.add_argument("--tz", help="IANA zone; resolved from coordinates if omitted")
    parser.add_argument(
        "--estimated",
        action="store_true",
        help="mark the time as approximate rather than exact",
    )
    parser.add_argument(
        "--unknown-time",
        action="store_true",
        help="calculate without a birth time",
    )
    parser.add_argument(
        "--dasha",
        action="store_true",
        help="also print the Vimshottari Dasha timeline",
    )
    parser.add_argument(
        "--skeleton",
        action="store_true",
        help="also print a reference-fixture stub",
    )
    args = parser.parse_args()

    if args.unknown_time:
        confidence = BirthTimeConfidence.UNKNOWN
        birth_time = None
    else:
        if not args.time:
            parser.error("--time is required unless --unknown-time is given")
        confidence = (
            BirthTimeConfidence.ESTIMATED
            if args.estimated
            else BirthTimeConfidence.EXACT
        )
        hour, _, minute = args.time.partition(":")
        birth_time = time(int(hour), int(minute or 0))

    birth = BirthData(
        birth_date=date.fromisoformat(args.date),
        birth_time=birth_time,
        time_confidence=confidence,
        latitude=args.lat,
        longitude=args.lon,
        timezone_name=args.tz,
    )

    _print_chart(calculate_d1_chart(birth))

    if args.dasha:
        _print_dasha(birth)

    if args.skeleton:
        _print_skeleton(birth)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
