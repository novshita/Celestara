"""Stored timestamps are UTC, written aware, and compared after `as_utc`.

Found by running the suite on Postgres: it returns timezone-aware values where
SQLite returns naive ones, and comparing the two raised `TypeError`, which made
every logged-in request fail.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.core.timeutil import as_utc, utc_now

IST = timezone(timedelta(hours=5, minutes=30))


def test_utc_now_is_aware_utc():
    assert utc_now().utcoffset() == timedelta(0)


def test_a_naive_time_is_taken_to_be_utc():
    naive = datetime(2026, 11, 9, 12, 0)

    assert as_utc(naive) == datetime(2026, 11, 9, 12, 0, tzinfo=timezone.utc)
    assert as_utc(naive).utcoffset() == timedelta(0)


def test_an_aware_time_is_converted_to_utc_not_relabelled():
    ist = datetime(2026, 11, 9, 17, 30, tzinfo=IST)

    assert as_utc(ist) == datetime(2026, 11, 9, 12, 0, tzinfo=timezone.utc)


def test_naive_and_aware_forms_of_one_instant_compare_equal_after_as_utc():
    # What SQLite hands back versus what Postgres hands back for the same row.
    from_sqlite = datetime(2026, 11, 9, 12, 0)
    from_postgres = datetime(2026, 11, 9, 17, 30, tzinfo=IST)

    assert as_utc(from_sqlite) == as_utc(from_postgres)
    assert as_utc(from_sqlite) < utc_now() + timedelta(days=3650)
